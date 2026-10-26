import { join } from 'node:path';
import { PROFILES_DIR, SHARED_DIR } from '../../lib/constants.mjs';
import { readMeta } from '../../lib/config.mjs';
import { readJsonFile } from '../../lib/json-fs.mjs';
import { info, error } from '../../lib/ui.mjs';
import { t } from '../../lib/i18n.mjs';

export async function mcp(args = []) {
  if (args.length > 1 || (args[0] && args[0] !== 'list')) {
    error(t('mcp.noWrites'));
    process.exitCode = 1;
    return;
  }
  info(t('mcp.preserved'));
  const files = [join(SHARED_DIR, 'settings.json'),
    ...readMeta().profiles.map(name => join(PROFILES_DIR, name, 'settings.local.json'))];
  for (const file of files) {
    const data = readJsonFile(file);
    const names = Object.keys(data.mcpServers ?? {});
    const disabled = Array.isArray(data.disabledMcpServers) ? data.disabledMcpServers : [];
    if (names.length || disabled.length) {
      console.log(`${file}: ${names.join(', ') || t('mcp.noServers')}`);
      if (disabled.length) console.log(`  ${t('mcp.disabled', { list: disabled.join(', ') })}`);
    }
  }
  info(t('mcp.where'));
  info(t('mcp.see'));
}
