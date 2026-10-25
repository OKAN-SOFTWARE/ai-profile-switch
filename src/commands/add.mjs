import { color, success } from '../lib/ui.mjs';
import { createProfile, validateProfileName, profileExists } from '../lib/profile.mjs';
import { readMeta } from '../lib/config.mjs';

export async function add(name) {
  const err = validateProfileName(name);
  if (err) throw new Error(err);
  const meta = readMeta();
  if (profileExists(name) || meta.profiles.includes(name)) {
    throw new Error(`Profile "${name}" already exists`);
  }
  createProfile(name, meta.shareSettings !== false);
  success(`Created profile: ${name}`);
  console.log(`  Run ${color.cyan('claude')}, choose ${color.cyan(name)}, and sign in to the intended account.`);
  console.log(`  To switch without launching: ${color.cyan(`cpf ${name}`)}`);
}
