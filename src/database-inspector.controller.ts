import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  Query,
} from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  DB_METADATA,
  generateAllJsClass,
  InspectorService,
} from './db/inspector'

@ApiTags('001 - Database Inspector')
@Controller('001-db-inspector')
export class DatabaseInspectorController {
  constructor(private inspector: InspectorService) {}

  @Get('fetch-metadata')
  async fetchMetadata() {
    return DB_METADATA.getClasses()
  }

  @Get('generate-classes')
  @ApiQuery({ type: Boolean, name: 'omitNull', required: false })
  @ApiQuery({ type: Boolean, name: 'includeDecorator', required: false })
  async generateTypescriptClasses(
    @Query('omitNull', new DefaultValuePipe(false), new ParseBoolPipe())
    omitNull: boolean,
    @Query('includeDecorator', new DefaultValuePipe(false), new ParseBoolPipe())
    includeDecorator: boolean,
  ) {
    const cache = await this.inspector.fetchDatabaseMetadata()
    return generateAllJsClass(cache, {
      omitNull,
      includeDecorator: includeDecorator
        ? ['table', 'column', 'relation']
        : undefined,
      parentClass: {
        className: 'TrackedTable',
        fields: [
          { name: 'deleted', type: 'boolean' },
          { name: 'createdOn', type: 'Date' },
          { name: 'updatedOn', type: 'Date' },
        ],
      },
    })
  }
}
