// config/index.ts valida el entorno al importarse y hace process.exit(1) si
// falta algo, asi que los tests necesitan valores ficticios antes de nada.
process.env.HOMEBOX_URL ??= 'http://homebox.test';
process.env.HOMEBOX_API_KEY ??= 'test-key';
process.env.GROQ_API_KEY ??= 'test-key';
process.env.NODE_ENV = 'test';
