import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User, UserDocument } from '../users/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const GUEST_NAMES = [
  'Aurora',
  'Blaze',
  'Cedar',
  'Dusk',
  'Echo',
  'Fern',
  'Gale',
  'Haven',
  'Iris',
  'Jade',
];

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{
    token: string;
    user: { id: string; name: string; email: string; isGuest: boolean };
  }> {
    const { name, email, password } = registerDto;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isGuest: false,
    });

    const savedUser = await user.save();

    const payload = {
      sub: savedUser._id.toString(),
      name: savedUser.name,
      email: savedUser.email,
      isGuest: false,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: savedUser._id.toString(),
        name: savedUser.name,
        email: savedUser.email,
        isGuest: false,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<{
    token: string;
    user: { id: string; name: string; email: string; isGuest: boolean };
  }> {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      isGuest: false,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        isGuest: false,
      },
    };
  }

  async guestLogin(name?: string): Promise<{
    token: string;
    user: { id: string; name: string; isGuest: boolean };
  }> {
    const guestId = randomUUID();
    const guestName =
      name?.trim() ||
      `Guest ${GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]}`;

    const payload = {
      sub: guestId,
      name: guestName,
      isGuest: true,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: guestId,
        name: guestName,
        isGuest: true,
      },
    };
  }

  async validateToken(
    token: string,
  ): Promise<{ id: string; name: string; isGuest: boolean } | null> {
    try {
      const payload = this.jwtService.verify(token);
      return { id: payload.sub, name: payload.name, isGuest: payload.isGuest };
    } catch {
      return null;
    }
  }
}
