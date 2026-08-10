import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from './member.schema';
import { CreateMemberDto } from './dto/create-member.dto';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async create(createMemberDto: CreateMemberDto, userId: string): Promise<Member> {
    const member = new this.memberModel({ ...createMemberDto, userId });
    return member.save();
  }

  async findAll(userId: string): Promise<Member[]> {
    return this.memberModel.find({ userId } as Record<string, any>).exec();
  }
}
