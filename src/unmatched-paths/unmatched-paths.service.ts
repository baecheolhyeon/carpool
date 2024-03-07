import { KakaoMobilityService } from './../common/kakaoMobilityService/kakao.mobility.service'
import { UserEntity } from './../users/users.entity'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { getConnection, Repository, Transaction } from 'typeorm'
import { UnmatchedPathEntity } from './unmatchedpaths.entity'
import { UnmatchedPathDto } from './dto/unmatchedPath.dto'

@Injectable()
export class UnmatchedPathsService {
  constructor(
    @InjectRepository(UnmatchedPathEntity)
    private readonly unmatchedPathRepository: Repository<UnmatchedPathEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly kakaoMobilityService: KakaoMobilityService,
  ) {}

  async createUnmatchedPath(
    unmatchedPathDto: UnmatchedPathDto,
    userId,
  ): Promise<any> {
    const user = await this.userRepository.findOne(userId)
    if (user.unmatchedPath !== undefined) {
      const target = await this.unmatchedPathRepository.findOne(
        user.unmatchedPath,
      )
      target.startingPoint = {
        lat: unmatchedPathDto.lat,
        lng: unmatchedPathDto.lng,
      }
      const savedTarget = await this.unmatchedPathRepository.save(target)

      return savedTarget
    } else {
      const unmatchedPath = await this.unmatchedPathRepository.create({
        startingPoint: {
          lat: unmatchedPathDto.lat,
          lng: unmatchedPathDto.lng,
        },
      })

      const savedUnmatchedPath = await this.unmatchedPathRepository.save(
        unmatchedPath,
      )
      console.log('savedUnmatchedPath.id:', savedUnmatchedPath.id)
      user.unmatchedPath = savedUnmatchedPath
      console.log('user.unmatchedPath.id:', user.unmatchedPath.id)
      await this.userRepository.save(user)

      return savedUnmatchedPath
    }
  }

  async updateUnmatchedPath(body, userId) {
    // const user = await this.userRepository.findOne(userId)
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
      .where('user.id = :userId', {
        userId: userId,
      })
      .getOne()

    const target = await this.unmatchedPathRepository.findOne(
      user.unmatchedPath.id,
    )
    console.log('target.id:', target.id)
    target.destinationPoint = {
      lat: body.lat,
      lng: body.lng,
    }
    const savedTarget = await this.unmatchedPathRepository.save(target)

    console.log(
      typeof savedTarget.startingPoint.lat,
      typeof savedTarget.startingPoint.lng,
    )
    console.log(
      typeof savedTarget.destinationPoint.lat,
      typeof savedTarget.destinationPoint.lng,
    )
    console.log('출발지lat:', savedTarget.startingPoint.lat)
    console.log('출발지lng:', savedTarget.startingPoint.lng)
    console.log('목적지lat:', savedTarget.destinationPoint.lat)
    console.log('목적지lng:', savedTarget.destinationPoint.lng)
    const kakaoResponse = await this.kakaoMobilityService.getInfo(
      savedTarget.startingPoint.lat,
      savedTarget.startingPoint.lng,
      savedTarget.destinationPoint.lat,
      savedTarget.destinationPoint.lng,
    )
    savedTarget.fare = kakaoResponse.fare.taxi
    savedTarget.distance = Math.floor(kakaoResponse.distance / 1000)
    savedTarget.time = Math.floor(kakaoResponse.duration / 60)

    const reSavedTarget = await this.unmatchedPathRepository.save(savedTarget)
    user.unmatchedPath = reSavedTarget
    await this.userRepository.save(user)

    return reSavedTarget
  }

  async setMatching(user) {
    const targetUser = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
      .where('user.id = :userId', { userId: user.id })
      .getOne()

    const targetUnmatchedPath = await this.unmatchedPathRepository.findOne(
      targetUser.unmatchedPath.id,
    )

    targetUnmatchedPath.userIdArray = []

    async function fetchUnmatchedPaths(userId) {
      const queryBuilder = getConnection()
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .leftJoin('user.unmatchedPath', 'unmatchedPath')
        .where(
          '((unmatchedPath.id IS NULL OR unmatchedPath.id <> :userId) AND unmatchedPath.id IS NOT NULL) AND user.id <> :userId',
          {
            userId,
          },
        )
        .getMany()

      const userArray = await queryBuilder

      return userArray
    }

    const userArray = await fetchUnmatchedPaths(user.id)

    const userIdArray = userArray.map((user) => user.id)

    targetUnmatchedPath.userIdArray.push(...userIdArray)

    const savedTargetUnmatchedPath = await this.unmatchedPathRepository.save(
      targetUnmatchedPath,
    )

    if (savedTargetUnmatchedPath.userIdArray) {
      let tmpArray = []
      let resultArray = []
      tmpArray = await this.pushToTmpArray(savedTargetUnmatchedPath, tmpArray)
      console.log('tmpArray:', tmpArray)
      resultArray = await this.setResultArray(
        savedTargetUnmatchedPath,
        tmpArray,
        resultArray,
      )
      return resultArray
    } else {
      return '에러'
    }
  }

  async pushToTmpArray(savedTargetUnmatchedPath, tmpArray) {
    for (let i = 0; i < savedTargetUnmatchedPath.userIdArray.length; i++) {
      const targetUser = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
        .where('user.id = :userId', {
          userId: savedTargetUnmatchedPath.userIdArray[i],
        })
        .getOne()

      const targetUnmatchedPath = await this.unmatchedPathRepository.findOne(
        targetUser.unmatchedPath.id,
      )

      const kakaoResponse = await this.kakaoMobilityService.getInfo(
        savedTargetUnmatchedPath.startingPoint.lat,
        savedTargetUnmatchedPath.startingPoint.lng,
        targetUnmatchedPath.startingPoint.lat,
        targetUnmatchedPath.startingPoint.lng,
      )

      if (kakaoResponse.distance <= 10000) {
        tmpArray.push(savedTargetUnmatchedPath.userIdArray[i])
      }
    }
    return tmpArray
  }

  async setResultArray(savedTargetUnmatchedPath, tmpArray, resultArray) {
    for (let i = 0; i < tmpArray.length; i++) {
      if (i === 0) {
        resultArray.push(tmpArray[0])
      } else {
        // 반경 10km 이내에 있는 유저의 id 배열의 n번째 id
        const targetUser1 = await this.userRepository
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
          .where('user.id = :userId', {
            userId: tmpArray[i],
          })
          .getOne()
        const targetUnmatchedPath1 = await this.unmatchedPathRepository.findOne(
          targetUser1.unmatchedPath.id,
        )
        // 로그인한 유저와 tmpArray[i] 에 유저와의 길찾기 api 호출
        const kakaoResponse1 = await this.kakaoMobilityService.getInfo(
          savedTargetUnmatchedPath.destinationPoint.lat,
          savedTargetUnmatchedPath.destinationPoint.lng,
          targetUnmatchedPath1.destinationPoint.lat,
          targetUnmatchedPath1.destinationPoint.lng,
        )
        // resultArray 에 있는 값 === 현재까지 목적지가 가장 가까운 유저
        const targetUser2 = await this.userRepository
          .createQueryBuilder('user')
          .leftJoinAndSelect('user.unmatchedPath', 'unmatchedPath')
          .where('user.id = :userId', {
            userId: resultArray[0],
          })
          .getOne()
        const targetUnmatchedPath2 = await this.unmatchedPathRepository.findOne(
          targetUser2.unmatchedPath.id,
        )
        const kakaoResponse2 = await this.kakaoMobilityService.getInfo(
          savedTargetUnmatchedPath.destinationPoint.lat,
          savedTargetUnmatchedPath.destinationPoint.lng,
          targetUnmatchedPath2.destinationPoint.lat,
          targetUnmatchedPath2.destinationPoint.lng,
        )

        if (kakaoResponse1.distance < kakaoResponse2.distance) {
          resultArray.splice(0, 1)
          resultArray.push(tmpArray[i])
        }
      }
      return resultArray
    }
  }
}
