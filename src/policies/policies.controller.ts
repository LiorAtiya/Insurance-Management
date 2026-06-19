import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { IssuePolicyDto } from './dto/issue-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPoliciesDto } from './dto/query-policies.dto';

@Controller()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // Issue a new policy to a specific customer (nested route)
  @Post('customers/:customerId/policies')
  issue(
    @Param('customerId') customerId: string,
    @Body() dto: IssuePolicyDto,
  ) {
    return this.policiesService.issue(customerId, dto);
  }

  @Get('policies')
  findAll(@Query() query: QueryPoliciesDto) {
    return this.policiesService.findAll(query);
  }

  @Get('policies/:id')
  findOne(@Param('id') id: string) {
    return this.policiesService.findOne(id);
  }

  @Patch('policies/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.policiesService.update(id, dto);
  }

  @Delete('policies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id') id: string) {
    return this.policiesService.cancel(id);
  }
}
