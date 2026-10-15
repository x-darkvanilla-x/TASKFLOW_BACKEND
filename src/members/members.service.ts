import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from './member.schema';
import { User, UserDocument } from '../users/user.schema';
import { Workspace, WorkspaceDocument } from './workspace.schema';
import { CreateMemberDto } from './dto/create-member.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Workspace.name) private workspaceModel: Model<WorkspaceDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createMemberDto: CreateMemberDto, userId: string): Promise<Member> {
    const cleanUsername = createMemberDto.username
      ? createMemberDto.username.toLowerCase().replace(/^@/, '').trim()
      : createMemberDto.name.toLowerCase().replace(/\s+/g, '_');

    // Auto-link registered user ID if not provided
    let memberUserId = createMemberDto.memberUserId;
    if (!memberUserId) {
      const foundUser = await this.userModel
        .findOne({
          $or: [
            { username: cleanUsername },
            ...(createMemberDto.email ? [{ email: createMemberDto.email.toLowerCase().trim() }] : []),
            { name: { $regex: new RegExp(`^${createMemberDto.name.trim()}$`, 'i') } },
          ],
        })
        .exec();
      if (foundUser) {
        memberUserId = foundUser._id.toString();
      }
    }

    // Check if already a member in this workspace
    const existing = await this.memberModel
      .findOne({
        userId,
        $or: [
          { name: { $regex: new RegExp(`^${createMemberDto.name.trim()}$`, 'i') } },
          { username: cleanUsername },
          ...(memberUserId ? [{ memberUserId }] : []),
        ],
      })
      .exec();

    if (existing) {
      throw new ConflictException('This user is already a team member in this workspace');
    }

    let finalWorkspaceName = createMemberDto.workspaceName;
    if (createMemberDto.workspaceId && !createMemberDto.workspaceId.startsWith('ws-')) {
      const wsDoc = await this.workspaceModel.findById(createMemberDto.workspaceId).exec();
      if (wsDoc) {
        if (wsDoc.ownerId && wsDoc.ownerId !== userId) {
          throw new ForbiddenException('Only the workspace owner can add team members');
        }
        finalWorkspaceName = wsDoc.name;
      }
    }
    if (!finalWorkspaceName) {
      const ownerWs = await this.workspaceModel.findOne({ ownerId: userId }).sort({ createdAt: -1 }).exec();
      if (ownerWs?.name) finalWorkspaceName = ownerWs.name;
    }

    const member = new this.memberModel({
      ...createMemberDto,
      workspaceName: finalWorkspaceName,
      username: cleanUsername,
      memberUserId,
      userId,
    });
    const saved = await member.save();

    // Notify the added user (Owner does NOT get notification)
    if (memberUserId && memberUserId !== userId) {
      const ownerUser = await this.userModel.findById(userId).exec();
      const ownerName = ownerUser?.name || 'Workspace Owner';
      await this.notificationsService.create({
        recipientUserId: memberUserId,
        type: 'workspace_added',
        title: 'Added to Workspace',
        message: `You were added to "${finalWorkspaceName}" as ${createMemberDto.role || 'Member'} by ${ownerName}.`,
        link: '/team',
        actorId: userId,
        actorName: ownerName,
        metadata: {
          workspaceId: createMemberDto.workspaceId,
          workspaceName: finalWorkspaceName,
          role: createMemberDto.role || 'Member',
          actorName: ownerName,
          ownerId: userId,
        },
      });
    }

    return saved;
  }

  async createWorkspace(dto: { name: string; icon?: string; color?: string }, userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    const ownerName = user?.name || 'You';
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const workspace = new this.workspaceModel({
      name: dto.name.trim(),
      slug: slug || `ws-${Date.now()}`,
      icon: dto.icon || 'building',
      color: dto.color || '#4F46E5',
      ownerId: userId,
      ownerName,
    });
    const saved = await workspace.save();
    return {
      id: saved._id.toString(),
      name: saved.name,
      slug: saved.slug,
      icon: saved.icon,
      color: saved.color,
      role: 'Owner',
      plan: 'Free',
      ownerId: userId,
      ownerName,
    };
  }

  async updateWorkspace(id: string, dto: { name?: string; icon?: string; color?: string }, userId: string): Promise<any> {
    let ws: any = null;
    if (id.startsWith('ws-')) {
      ws = await this.workspaceModel.findOne({ ownerId: userId }).exec();
      if (!ws) {
        const user = await this.userModel.findById(userId).exec();
        ws = new this.workspaceModel({
          name: dto.name || 'My Workspace',
          ownerId: userId,
          ownerName: user?.name || 'You',
        });
      }
    } else {
      ws = await this.workspaceModel.findById(id).exec();
    }

    if (ws) {
      if (dto.name) {
        ws.name = dto.name.trim();
        await this.memberModel.updateMany(
          { $or: [{ workspaceId: ws._id.toString() }, { userId: ws.ownerId }] },
          { $set: { workspaceName: ws.name } }
        ).exec();
      }
      if (dto.icon) ws.icon = dto.icon;
      if (dto.color) ws.color = dto.color;
      await ws.save();
      return {
        id: ws._id.toString(),
        name: ws.name,
        icon: ws.icon,
        color: ws.color,
        ownerId: ws.ownerId,
        ownerName: ws.ownerName,
      };
    }
    return null;
  }

  async getAccessibleOwnerIds(userId: string): Promise<string[]> {
    const user = await this.userModel.findById(userId).exec();
    const cleanUsername = user?.username || user?.name?.toLowerCase().replace(/\s+/g, '_');
    const userEmail = user?.email?.toLowerCase();

    const memberRecords = await this.memberModel
      .find({
        $or: [
          { memberUserId: userId },
          ...(cleanUsername ? [{ username: cleanUsername }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      })
      .exec();

    const accessible = [userId];
    for (const mem of memberRecords) {
      if (mem.userId && !accessible.includes(mem.userId)) {
        accessible.push(mem.userId);
      }
    }
    return accessible;
  }

  async getMyWorkspaces(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId).exec();
    const ownerName = user?.name || 'You';
    const cleanUsername = user?.username || user?.name?.toLowerCase().replace(/\s+/g, '_');
    const userEmail = user?.email?.toLowerCase();

    // 1. Fetch workspaces owned by this user
    let ownedWorkspaces = await this.workspaceModel.find({ ownerId: userId }).exec();

    // If user has no workspaces saved yet, create their default workspace in MongoDB
    if (ownedWorkspaces.length === 0) {
      const defaultWs = new this.workspaceModel({
        name: 'My Workspace',
        slug: 'my-workspace',
        icon: 'building',
        color: '#4F46E5',
        ownerId: userId,
        ownerName,
      });
      const saved = await defaultWs.save();
      ownedWorkspaces = [saved];
    }

    const workspaces: any[] = await Promise.all(
      ownedWorkspaces.map(async (w) => {
        const memCount = await this.memberModel
          .countDocuments({
            userId,
            workspaceId: w._id.toString(),
          })
          .exec();
        return {
          id: w._id.toString(),
          name: w.name,
          slug: w.slug || 'workspace',
          icon: w.icon || 'building',
          color: w.color || '#4F46E5',
          role: 'Owner',
          plan: 'Free',
          membersCount: memCount + 1,
          ownerId: userId,
          ownerName,
        };
      })
    );

    // 2. Workspaces where user is a team member
    const memberRecords = await this.memberModel
      .find({
        $or: [
          { memberUserId: userId },
          ...(cleanUsername ? [{ username: cleanUsername }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      })
      .exec();

    for (const mem of memberRecords) {
      if (mem.userId === userId) continue; // Skip if self
      const owner = await this.userModel.findById(mem.userId).exec();
      const actualOwnerName = owner?.name || 'Workspace Owner';

      // Look up workspace document in MongoDB
      let wsDoc: any = null;
      if (mem.workspaceId && !mem.workspaceId.startsWith('ws-')) {
        wsDoc = await this.workspaceModel.findById(mem.workspaceId).exec();
      }
      if (!wsDoc) {
        wsDoc = await this.workspaceModel.findOne({ ownerId: mem.userId }).sort({ createdAt: -1 }).exec();
      }

      const finalWsName = wsDoc?.name || mem.workspaceName || `${actualOwnerName}'s Workspace`;
      const finalWsId = wsDoc?._id.toString() || mem.workspaceId || `ws-${mem.userId}`;
      const finalColor = wsDoc?.color || '#7C3AED';
      const finalIcon = wsDoc?.icon || 'building';

      const memCount = await this.memberModel
        .countDocuments({
          userId: mem.userId,
          workspaceId: finalWsId,
        })
        .exec();

      if (!workspaces.some((w) => w.id === finalWsId)) {
        workspaces.push({
          id: finalWsId,
          name: finalWsName,
          slug: finalWsName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: finalIcon,
          color: finalColor,
          role: mem.role || 'Member',
          plan: 'Team',
          membersCount: memCount + 1,
          ownerId: mem.userId,
          ownerName: actualOwnerName,
        });
      }
    }

    return workspaces;
  }

  async findAll(userId: string, targetOwnerId?: string, workspaceId?: string): Promise<any[]> {
    const ownerId = targetOwnerId || userId;

    if (ownerId !== userId) {
      const accessible = await this.getAccessibleOwnerIds(userId);
      if (!accessible.includes(ownerId)) {
        return [];
      }
    }

    const query: Record<string, any> = { userId: ownerId };
    if (workspaceId) {
      query.$or = [{ workspaceId }, { workspaceId: { $exists: false } }];
    }

    const members = await this.memberModel
      .find(query)
      .sort({ createdAt: 1 })
      .exec();

    // Include the owner in the members list
    const owner = await this.userModel.findById(ownerId).exec();
    const ownerMember = owner
      ? {
          _id: `owner-${owner._id}`,
          name: owner.name,
          username: owner.username || owner.name.toLowerCase().replace(/\s+/g, '_'),
          email: owner.email,
          role: 'Owner',
          avatarColor: 'bg-indigo-600',
          memberUserId: owner._id.toString(),
          userId: ownerId,
          isOwner: true,
        }
      : null;

    const list = members.map((m) => m.toObject());
    if (ownerMember) {
      return [ownerMember, ...list];
    }
    return list;
  }

  async searchUsers(query: string, currentUserId: string): Promise<any[]> {
    if (!query || !query.trim()) return [];
    const clean = query.trim().replace(/^@/, '');
    const regex = new RegExp(clean, 'i');

    const users = await this.userModel
      .find({
        _id: { $ne: currentUserId },
        $or: [{ username: regex }, { name: regex }, { email: regex }],
      })
      .select('_id name username email')
      .limit(10)
      .exec();

    return users.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      username: (u as any).username || u.name.toLowerCase().replace(/\s+/g, '_'),
      email: u.email,
    }));
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const member = await this.memberModel.findById(id).exec();
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Only the workspace owner can remove team members
    if (member.userId !== userId) {
      throw new ForbiddenException('Only the workspace owner can remove team members');
    }

    // Notify the removed user (Owner does NOT get notification)
    if (member) {
      let recipientUserId = member.memberUserId;
      if (!recipientUserId) {
        const found = await this.userModel
          .findOne({
            $or: [
              { username: member.username },
              ...(member.email ? [{ email: member.email.toLowerCase().trim() }] : []),
              { name: { $regex: new RegExp(`^${member.name.trim()}$`, 'i') } },
            ],
          })
          .exec();
        if (found) {
          recipientUserId = found._id.toString();
        }
      }

      if (recipientUserId && recipientUserId !== userId) {
        const actor = await this.userModel.findById(userId).exec();
        const actorName = actor?.name || 'Workspace Owner';
        let wsName = member.workspaceName;
        if (!wsName && member.workspaceId && !member.workspaceId.startsWith('ws-')) {
          const wsDoc = await this.workspaceModel.findById(member.workspaceId).exec();
          if (wsDoc?.name) wsName = wsDoc.name;
        }
        if (!wsName) {
          const wsDoc = await this.workspaceModel.findOne({ ownerId: member.userId }).sort({ createdAt: -1 }).exec();
          if (wsDoc?.name) wsName = wsDoc.name;
        }

        await this.notificationsService.create({
          recipientUserId,
          type: 'workspace_removed',
          title: 'Removed from Workspace',
          message: `You were removed from "${wsName || 'the workspace'}" by ${actorName}.`,
          link: '/team',
          actorId: userId,
          actorName,
          metadata: {
            workspaceName: wsName || 'the workspace',
            actorName,
          },
        });
      }
    }

    const result = await this.memberModel
      .deleteOne({ _id: id, userId })
      .exec();
    return result.deletedCount > 0;
  }
}
