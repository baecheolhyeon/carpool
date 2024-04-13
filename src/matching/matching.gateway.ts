import { CurrentUser } from './../common/decorators/current-user.decorator'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { UnmatchedPathsService } from 'src/unmatched-paths/unmatched-paths.service'
import { UserEntity } from 'src/users/users.entity'
import { Repository, getRepository } from 'typeorm'
import { Socket } from 'socket.io'
import { MatchedPathEntity } from '../matched-paths/matchedPaths.entity'
import { MatchedPathsService } from '../matched-paths/matched-paths.service'
import { EntityManager } from 'typeorm'
import { KakaoMobilityService } from 'src/common/kakaoMobilityService/kakao.mobility.service'
import * as fs from 'fs'

@WebSocketGateway()
export class MatchingGateway implements OnGatewayDisconnect {
  constructor(
    private readonly unmatchedPathService: UnmatchedPathsService,
    private readonly matchedPathService: MatchedPathsService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(MatchedPathEntity)
    private readonly matchedPathRepository: Repository<MatchedPathEntity>,
    private readonly entityManager: EntityManager,
    private readonly kakaoMobilityService: KakaoMobilityService,
  ) {}

  private logger = new Logger('gateway')
  @SubscribeMessage('driverMode')
  async handleDriverMode(
    @ConnectedSocket() socket: Socket,
    @MessageBody() user,
  ) {
    const currentUser = await this.userRepository.findOne(user.id)
    currentUser.socketId = socket.id
    currentUser.isDriver = true
    await this.userRepository.save(currentUser)
  }
  isAlreadySentMap = new Map()

  @SubscribeMessage('doMatch')
  async handleSocket(@ConnectedSocket() socket: Socket, @MessageBody() body) {
    const user = await this.userRepository.findOne({
      where: { id: body.id },
      relations: ['matchedPath'],
    })
    user.socketId = socket.id
    user.isDriver = false
    user.isMatching = false
    user.matchedPath = null
    user.pgToken = null
    await this.userRepository.save(user)

    let response = null
    let matchFound = false
    const startTime = Date.now()
    while (!matchFound) {
      response = await this.unmatchedPathService.setMatching(user)
      if (response !== null) {
        matchFound = true
      } else {
        console.log('대기중')
        await this.unmatchedPathService.sleep(1000)
      }
      if (Date.now() - startTime > 60000) {
        break // 30초가 넘었다면 반복문 종료
      }
    }
    if (Date.now() - startTime <= 60000) {
      const matchedUserUP = response.matchedUserUP
      const oppUser = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
        .leftJoinAndSelect('user.matchedPath', 'matchedPath')
        .where('unmatchedPath.id = :unmatchedPathId', {
          unmatchedPathId: matchedUserUP.id,
        })
        .getOne()

      if (
        oppUser.matchedPath == null &&
        !this.isAlreadySentMap.get(response.matchedPath.summary.origin.x)
      ) {
        this.isAlreadySentMap.set(response.matchedPath.summary.origin.x, true)
        await this.matchedPathService.createMatchedPath(
          response.matchedPath,
          response.currentFare,
          response.matchedFare,
          user,
          oppUser,
        )
        socket.emit('matching', response)
        socket.to(oppUser.socketId).emit('matching', response)
      }

      const updateUser = await this.userRepository.findOne({
        where: { id: body.id },
        relations: ['matchedPath'],
      })
      if (updateUser.matchedPath == null) {
        socket.emit('oppAlreadyMatched')
      }
    } else {
      socket.emit('noPeople')
    }
  }

  async sendWantLocationEvent(matchedPath, socket) {
    const drivers = await this.userRepository.find({
      where: { isDriver: true },
    })
    console.log('드라이버', drivers)

    for (const driver of drivers) {
      console.log('wantLocation 이벤트 실행중')
      console.log('driver:', driver)
      socket.to(driver.socketId).emit('wantLocation', matchedPath)
    }
  }

  @SubscribeMessage('accept')
  async handleAccept(@ConnectedSocket() socket: Socket, @MessageBody() user) {
    user.socketId = socket.id
    user.isMatching = true
    await this.userRepository.save(user)
    const targetUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.matchedPath', 'matchedPath')
      .where('user.id = :userId', {
        userId: user.id,
      })
      .getOne()
    console.log('타겟유저:', targetUser.matchedPath)
    let matchedPath = await this.matchedPathRepository.findOne({
      where: { id: targetUser.matchedPath.id },
      relations: ['users'],
    })
    const otherUser = matchedPath.users.find(
      (oppUser) => oppUser.id !== user.id,
    )

    let isAccepted = false
    //수락대기 경과시간
    let elapsedTime = 0
    //수락대기 최대시간
    const timeoutLimit = 60
    while (!isAccepted && elapsedTime < timeoutLimit) {
      if (matchedPath.users[0].isMatching && matchedPath.users[1].isMatching) {
        isAccepted = true
      } else {
        console.log('수락대기중')
        await this.unmatchedPathService.sleep(1000)
        const updatedMatchedPath = await this.entityManager.findOne(
          MatchedPathEntity,
          {
            where: { id: targetUser.matchedPath.id },
            relations: ['users'],
          },
        )
        matchedPath = updatedMatchedPath
        console.log(matchedPath.users)
        elapsedTime += 1
      }
    }

    if (isAccepted && elapsedTime < timeoutLimit) {
      //택시기사매칭 로직
      const drivers = await this.userRepository.find({
        where: { isDriver: true },
      })
      console.log('드라이버', drivers)
      if (!this.isAlreadySentMap.get(matchedPath.id)) {
        for (const driver of drivers) {
          console.log('wantLocation 이벤트 실행중')
          await this.sendWantLocationEvent(matchedPath, socket)
        }
        this.isAlreadySentMap.set(matchedPath.id, true)
      }
      console.log(this.isAlreadySentMap)
      return '기사매칭 대기중'
    } else {
      if (socket.id) {
        socket.emit('rejectMatching')
      }
      if (otherUser.socketId) {
        socket.to(otherUser.socketId).emit('rejectMatching')
      }
    }
  }

  @SubscribeMessage('reject')
  async handleReject(@ConnectedSocket() socket: Socket, @MessageBody() user) {
    const targetUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.matchedPath', 'matchedPath')
      .where('user.id = :userId', {
        userId: user.id,
      })
      .getOne()
    console.log('타겟유저:', targetUser.matchedPath)
    const matchedPath = await this.matchedPathRepository.findOne({
      where: { id: targetUser.matchedPath.id },
      relations: ['users'],
    })
    const otherUser = matchedPath.users.find(
      (oppUser) => oppUser.id !== user.id,
    )
    console.log(otherUser)
    if (otherUser.socketId) {
      socket.to(otherUser.socketId).emit('rejectMatching')
    }
    socket.emit('rejectMatching')
    return
  }

  @SubscribeMessage('hereIsLocation')
  async requestToDriver(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data,
  ) {
    console.log('hereIsLocation 실행중')
    const kakaoResponse = await this.kakaoMobilityService.getInfo(
      data.matchedPath.origin.lat,
      data.matchedPath.origin.lng,
      data.lat,
      data.lng,
    )
    console.log(kakaoResponse.summary.duration)

    if (kakaoResponse.summary.duration <= 300) {
      console.log('택시기사에게 send:', data.matchedPath)
      socket.emit('letsDrive', data.matchedPath)
      return
    }
  }

  //택시기사가 수락했을때
  @SubscribeMessage('imDriver')
  async handleDriver(
    @ConnectedSocket() socket: Socket,
    @MessageBody() matchedPath,
  ) {
    //먼저 잡은 기사가 있을때
    if (matchedPath.isReal) {
      socket.emit('alreadyMatched')
    } else {
      //카카오페이결제 링크 받아오기
      matchedPath.isReal = true
      await this.matchedPathRepository.save(matchedPath)
      const firstUserUrl = await this.kakaoMobilityService.getPayment(
        Math.floor(matchedPath.firstFare),
      )
      const secondUserUrl = await this.kakaoMobilityService.getPayment(
        Math.floor(matchedPath.secondFare),
      )

      if (matchedPath.users[0].socketId && matchedPath.users[1].socketId) {
        socket
          .to(matchedPath.users[0].socketId)
          .emit('kakaoPay', firstUserUrl.next_redirect_pc_url)
        socket
          .to(matchedPath.users[1].socketId)
          .emit('kakaoPay', secondUserUrl.next_redirect_pc_url)

        console.log('tid:', firstUserUrl.tid, secondUserUrl.tid)

        await this.unmatchedPathService.sleep(5000)

        const updatedMatchedPath = await this.entityManager.findOne(
          MatchedPathEntity,
          {
            where: { id: matchedPath.id },
            relations: ['users'],
          },
        )
        matchedPath = updatedMatchedPath

        let isAccepted = false
        //수락대기 경과시간
        let elapsedTime = 0
        //수락대기 최대시간
        const timeoutLimit = 100
        console.log('pgToken:', matchedPath)
        while (!isAccepted && elapsedTime < timeoutLimit) {
          if (
            matchedPath.users[0].pgToken !== null &&
            matchedPath.users[1].pgToken !== null
          ) {
            isAccepted = true
          } else {
            console.log('수락대기중')
            await this.unmatchedPathService.sleep(1000)
            const updatedMatchedPath = await this.entityManager.findOne(
              MatchedPathEntity,
              {
                where: { id: matchedPath.id },
                relations: ['users'],
              },
            )
            matchedPath = updatedMatchedPath
            console.log(matchedPath.users)
            elapsedTime += 1
          }
        }

        if (isAccepted && elapsedTime < timeoutLimit) {
          await this.kakaoMobilityService.getApprove(
            firstUserUrl.tid,
            matchedPath.users[0].pgToken,
          )
          await this.kakaoMobilityService.getApprove(
            secondUserUrl.tid,
            matchedPath.users[1].pgToken,
          )

          const updatedMatchedPath = await this.entityManager.findOne(
            MatchedPathEntity,
            {
              where: { id: matchedPath.id },
              relations: ['users'],
            },
          )
          const firstUser = await this.entityManager.findOne(UserEntity, {
            where: { id: matchedPath.users[0].id },
            relations: ['unmatchedPath'],
          })
          const secondUser = await this.entityManager.findOne(UserEntity, {
            where: { id: matchedPath.users[1].id },
            relations: ['unmatchedPath'],
          })
          console.log(
            'imdriver',
            firstUser.unmatchedPath,
            secondUser.unmatchedPath,
          )
          socket
            .to(updatedMatchedPath.users[0].socketId)
            .emit('location', firstUser.unmatchedPath)
          socket
            .to(updatedMatchedPath.users[1].socketId)
            .emit('location', secondUser.unmatchedPath)

          socket.emit('navigation', updatedMatchedPath)
          let setInt
          // eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
          setInt = setInterval(() => {
            socket.emit('updateLocation', updatedMatchedPath)
          }, 10000)
          socket.on('finishDrive', () => {
            console.log('finishDrive 실행중')
            clearInterval(setInt)
            socket
              .to(updatedMatchedPath.users[0].socketId)
              .emit('finishTracking')
            socket
              .to(updatedMatchedPath.users[1].socketId)
              .emit('finishTracking')
          })
          return '승객들 결제완료'
        } else {
          if (matchedPath.users[0].socketId) {
            socket.to(matchedPath.users[0].socketId).emit('failedPay')
          }
          if (matchedPath.users[1].socketId) {
            socket.to(matchedPath.users[1].socketId).emit('failedPay')
          }
          socket.emit('failedPay')
        }
      }
    }
  }

  @SubscribeMessage('deleteUnmatchedPathAndEtc')
  async handleDbUpdate(@ConnectedSocket() socket: Socket) {
    const user = await this.userRepository.findOne({
      where: { socketId: socket.id },
      relations: ['matchedPath', 'unmatchedPath'],
    })
    //isMatching 과 socketId handleDisconnect에서 처리
    user.unmatchedPath = null
    user.matchedPath = null

    await this.userRepository.save(user)

    socket.to(user.socketId).emit('delteSocketIdAndEtc')
  }

  @SubscribeMessage('socketIdSave')
  async handleCompletedPay(
    @ConnectedSocket() socket: Socket,
    @MessageBody() user,
  ) {
    user.socketId = socket.id
    user.isMatching = true
    await this.userRepository.save(user)
  }

  @SubscribeMessage('realTimeLocation')
  async handleRealTimeLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data,
  ) {
    const matchedPath = await this.entityManager.findOne(MatchedPathEntity, {
      where: { id: data.matchedPath.id },
      relations: ['users'],
    })
    console.log('realTimeLocation 실행중', matchedPath.users)

    socket
      .to(matchedPath.users[0].socketId)
      .emit('hereIsRealTimeLocation', data)

    socket
      .to(matchedPath.users[1].socketId)
      .emit('hereIsRealTimeLocation', data)
  }

  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const user = await this.userRepository.findOne({
      where: { socketId: socket.id },
      relations: ['matchedPath', 'unmatchedPath'],
    })
    console.log('diconnect user:', user)
    if (user) {
      user.isMatching = false
      user.socketId = null
      user.isDriver = false
      user.pgToken = null
      user.isAdmin = false
      await this.userRepository.save(user)
    }
    this.logger.log(`disconnected : ${socket.id} ${socket.nsp.name}`)
  }
}
