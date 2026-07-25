import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { DepartmentTemplatesService } from './department-templates.service';
import {
  CreateDepartmentTemplateDto,
  UpdateDepartmentTemplateDto,
} from './dto/department-template.dto';
import { Roles, Public } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * DepartmentTemplatesController — /api/v1/department-templates
 *
 * SRP : Only handles HTTP routing and input/output shaping for dept templates.
 * ISP : Exposes only the endpoints this resource needs — no unrelated routes.
 *
 * All write operations are restricted to SuperAdmin.
 * GET (list + read) is accessible to any authenticated admin.
 */
@Controller({ path: 'department-templates', version: '1' })
@ApiCommon('department_templates')
export class DepartmentTemplatesController {
  constructor(private readonly service: DepartmentTemplatesService) {}

  // ─── List ───────────────────────────────────────────────────────────────────
  // Public so the unauthenticated onboarding wizard can render template options
  // before the user has a JWT. Write operations below still require SuperAdmin.

  @Public()
  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('industryGroup') industryGroup?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findAll({
      category,
      industryGroup,
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ─── Read One ───────────────────────────────────────────────────────────────

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateDepartmentTemplateDto) {
    return this.service.create(dto);
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
