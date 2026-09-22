/**
 * The password an account is created with.
 *
 * `<nama>123`, lowercased and stripped of anything that is not a letter or a
 * digit. It is deliberately guessable: eight people have to be told their
 * password out loud at a booth, and something unguessable would end up written
 * on a sticky note instead.
 *
 * The consequence is faced rather than ignored. Every account created this way
 * is flagged `mustChangePassword`, the staff panel says so on every screen until
 * it is changed, and `changePassword` refuses to "change" a password to this
 * same value.
 */
export function initialPasswordFor(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    // Strip combining marks, so a name typed with an accent still yields a
    // password somebody can type on a phone keyboard.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

  return `${slug}123`;
}
