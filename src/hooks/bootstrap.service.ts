import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { DB_METADATA } from '../db/inspector'
import { InspectorService } from '../db'

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(private dbInspector: InspectorService) {}

  async onApplicationBootstrap() {
    const tableCache = await this.dbInspector.fetchDatabaseMetadata()
    DB_METADATA.setTableCache(tableCache)
  }
}
