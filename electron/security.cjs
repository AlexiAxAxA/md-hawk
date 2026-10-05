function externalUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\x7f]/.test(value)) throw new Error('Недопустимая внешняя ссылка');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Разрешены только HTTP и HTTPS ссылки');
  return url.href;
}
module.exports = { externalUrl };
