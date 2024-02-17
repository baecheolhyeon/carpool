import { RequestDto } from './signup.request.dto'
import { Body, Controller, Get, Post, Redirect, Render } from '@nestjs/common'
import { SignupService } from './signup.service'
import { response } from 'express'

@Controller('signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Get()
  @Render('signup')
  tmp() {
    return
  }

  @Post()
  async createUser(@Body() requestDto: RequestDto) {
    return await this.signupService.createUser(requestDto)
  }
}
