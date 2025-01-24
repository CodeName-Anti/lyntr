import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { verifyAuthJWT } from '@/server/jwt';
import { db } from '@/server/db';
import { users, lynts, history } from '@/server/schema';
import { and, eq, sql } from 'drizzle-orm';
import { handleFeed } from './handle';
import { mainFeed } from './main';

async function updateViewsAndHistory(userId: string, lyntIds: string[]) {
	for (const lyntId of lyntIds) {
		await db.transaction(async (trx) => {
			await trx
				.update(lynts)
				.set({ views: sql`${lynts.views} + 1` })
				.where(eq(lynts.id, lyntId));

			await trx
				.insert(history)
				.values({
					user_id: userId,
					lynt_id: lyntId,
					createdAt: sql`now()`
				})
				.onConflictDoUpdate({
					target: [history.user_id, history.lynt_id],
					set: { createdAt: sql`now()` }
				});
		});
	}
}

export const GET: RequestHandler = async ({ request, cookies, url }) => {
	const authCookie = cookies.get('_TOKEN__DO_NOT_SHARE');
	const handle = url.searchParams.get('handle');
	const lyntParent = url.searchParams.get('lyntrParent');

	if (!authCookie) {
		return json({ error: 'Missing authentication' }, { status: 401 });
	}

	try {
		const jwtPayload = await verifyAuthJWT(authCookie);
		if (!jwtPayload.userId) {
			throw new Error('Invalid JWT token');
		}
		const userId = jwtPayload.userId;
		let result;

		if (handle) {
            const [lynt] = await db.select().from(lynts).where(eq(lynts.id, lyntParent.toString()));
			const userResult = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.handle, handle))
				.limit(1);
			const user = userResult[0];
			if (!user) {
				return json({ error: 'User not found' }, { status: 404 });
			}else {
				result = lynt
			}
		} else {
			result = await mainFeed(userId, 20);
		}

		// Start updating views and history in the background
		const lyntIds = result.map((lynt) => lynt.id);
		updateViewsAndHistory(userId, lyntIds).catch((error) => {
			console.error('Error updating views and history:', error);
		});

		return json({ lynts: result });
	} catch (error) {
		console.error('Authentication error:', error);
		return json({ error: 'Authentication failed' }, { status: 401 });
	}
};
