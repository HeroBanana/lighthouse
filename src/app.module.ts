import {Module} from '@nestjs/common';

import {TypeOrmModule} from "@nestjs/typeorm";

import {AppController} from './app.controller';
import {AppService} from './app.service';

import {LighthouseModule} from "./lighthouse/lighthouse.module";

import { User } from './users/user.entity';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'mysql',
            host: 'localhost',
            port: 3306,
            username: 'root',
            password: 'root',
            database: 'nest_graphql',
            entities: [
                User
            ],
            synchronize: true,
        }),
        LighthouseModule.forRoot(),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
