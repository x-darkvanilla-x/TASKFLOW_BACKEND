import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  create(@Body() createMemberDto: CreateMemberDto, @Request() req) {
    return this.membersService.create(createMemberDto, req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.membersService.findAll(req.user.id);
  }
}
