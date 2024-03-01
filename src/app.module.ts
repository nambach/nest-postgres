import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseInspectorController } from './database-inspector.controller'
import { DbService, InspectorService } from './db'

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [DatabaseInspectorController],
  providers: [InspectorService, DbService],
})
export class AppModule {}
