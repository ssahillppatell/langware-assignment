import chalk from "chalk"
import consola from "consola"

export const log = {
    info: (...args: any[]) => consola.info(chalk.blue(...args)),
    error: (...args: any[]) => consola.error(chalk.red(...args)),
    warn: (...args: any[]) => consola.warn(chalk.yellow(...args)),
    debug: (...args: any[]) => consola.debug(chalk.gray(...args)),
    verbose: (...args: any[]) => consola.verbose(chalk.magenta(...args)),
    success: (...args: any[]) => consola.success(chalk.green(...args)),
}