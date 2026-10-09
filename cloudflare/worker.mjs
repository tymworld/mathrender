import {handleClassroom, cleanupDeleted} from './classroom-api.mjs';

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/classroom/')) return handleClassroom(request, env);
    return env.ASSETS.fetch(request);
  },
  scheduled(_event, env, context) { context.waitUntil(cleanupDeleted(env)); }
};
