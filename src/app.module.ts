import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import * as Joi from 'joi'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'
import { AppController } from './app.controller'
import { UserEntity } from './users/users.entity'
import { UsersModule } from './users/users.module'
import { UnmatchedPathsModule } from './unmatched-paths/unmatched-paths.module'
import { MatchedPathsModule } from './matched-paths/matched-paths.module'
import { UnmatchedPathEntity } from './unmatched-paths/unmatchedpaths.entity'
import { MatchedPathEntity } from './matched-paths/matchedPaths.entity'
import { SignupModule } from './signup/signup.module'
import { MatchingModule } from './matching/matching.module'

const typeOrmModuleOptions = {
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => ({
    namingStrategy: new SnakeNamingStrategy(),
    type: 'postgres',
    host: configService.get('DB_HOST'), // process.env.DB_HOST
    port: configService.get('DB_PORT'),
    username: configService.get('DB_USERNAME'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_NAME'),
    entities: [UserEntity, UnmatchedPathEntity, MatchedPathEntity],
    synchronize: true, //! set 'false' in production
    autoLoadEntities: true,
    logging: false,
    keepConnectionAlive: true,
  }),
  inject: [ConfigService],
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test', 'provision')
          .default('development'),
        PORT: Joi.number().default(5000),
        SECRET_KEY: Joi.string().required(),
        ADMIN_USER: Joi.string().required(),
        ADMIN_PASSWORD: Joi.string().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_NAME: Joi.string().required(),
      }),
    }),
    TypeOrmModule.forRootAsync(typeOrmModuleOptions),
    UsersModule,
    UnmatchedPathsModule,
    MatchedPathsModule,
    SignupModule,
    MatchingModule,
  ],
  controllers: [AppController],
  providers: [UserEntity, UnmatchedPathEntity],
})
export class AppModule {}
