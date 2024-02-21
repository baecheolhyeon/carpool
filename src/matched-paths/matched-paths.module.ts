import { UserEntity } from 'src/users/users.entity'
import { Module } from '@nestjs/common'
import { MatchedPathsController } from './matched-paths.controller'
import { MatchedPathsService } from './matched-paths.service'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MatchedPathEntity } from './matchedPaths.entity'

@Module({
  imports: [TypeOrmModule.forFeature([MatchedPathEntity, UserEntity])],
  controllers: [MatchedPathsController],
  providers: [MatchedPathsService],
})
export class MatchedPathsModule {}
