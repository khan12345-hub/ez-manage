import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser } from "src/auth/decorators/current-user.decorator";


import { GlobalSearchService } from "./global-search.service";
import { SessionUser } from "src/auth/types/session-user.type";
import { SearchDto } from "./dto/global-search.dto";

@Controller("search")
export class GlobalSearchController {
  constructor(
    private readonly globalSearchService: GlobalSearchService,
  ) {}

  @Get()
  search(
    @CurrentUser() user: SessionUser,
    @Query() dto: SearchDto,
  ) {
    return this.globalSearchService.search(user.id, dto);
  }
}