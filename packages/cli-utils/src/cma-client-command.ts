import {
  ApiError,
  buildClient,
  Client,
  LogLevel,
} from '@datocms/cma-client-node';
import { Flags } from '@oclif/core';
import { DatoProjectConfigCommand } from './dato-project-config-command';
import * as chalk from 'chalk';

export const logLevelMap = {
  NONE: LogLevel.NONE,
  BASIC: LogLevel.BASIC,
  BODY: LogLevel.BODY,
  BODY_AND_HEADERS: LogLevel.BODY_AND_HEADERS,
} as const;

export type LogLevelFlagEnum = keyof typeof logLevelMap;
export const logLevelOptions = Object.keys(logLevelMap) as LogLevelFlagEnum[];

export abstract class CmaClientCommand<
  T extends typeof CmaClientCommand.flags,
> extends DatoProjectConfigCommand<T> {
  static flags = {
    ...DatoProjectConfigCommand.flags,
    'api-token': Flags.string({
      description: 'Specify a custom API key to access a project',
      env: 'DATOCMS_API_KEY',
    }),
    'log-level': Flags.enum<LogLevelFlagEnum>({
      options: logLevelOptions,
      description: 'Level of logging for performed API calls',
    }),
    'base-url': Flags.string({ hidden: true }),
  };

  protected client!: Client;

  protected async init(): Promise<void> {
    await super.init();

    const apiToken =
      this.parsedFlags['api-token'] || this.datoProjectConfig?.apiToken;

    const baseUrl =
      this.parsedFlags['base-url'] || this.datoProjectConfig?.baseUrl;

    const logLevelCode =
      this.parsedFlags['log-level'] || this.datoProjectConfig?.logLevel;

    const logLevel =
      this.parsedFlags.json || this.parsedFlags.output || !logLevelCode
        ? LogLevel.NONE
        : logLevelMap[logLevelCode];

    if (!apiToken) {
      this.error(`Cannot find an API key to use to call DatoCMS!`, {
        suggestions: [
          `The API key to use is determined by looking at:
* The --apiToken flag
* The DATOCMS_API_KEY environment variable
* The settings contained in ${this.datoConfigPath}`,
        ],
      });
    }

    this.client = buildClient({
      apiToken,
      baseUrl,
      logLevel,
      logFn: (message) => {
        this.log(chalk.gray(message));
      },
    });
  }

  protected async catch(
    err: Error & { exitCode?: number | undefined },
  ): Promise<void> {
    try {
      return await super.catch(err);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.findError('INVALID_AUTHORIZATION_HEADER')) {
          this.error('Invalid API token');
        }

        if (err.findError('INSUFFICIENT_PERMISSIONS')) {
          this.error(
            'The API token does not have the necessary permission to perform the operation',
          );
        }
      }

      throw err;
    }
  }
}
