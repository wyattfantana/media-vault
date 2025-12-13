import express from 'express';
import { curatedListsService } from '../services/curated-lists.service.js';
import { auth } from '../auth.js';

export const curatedListsRouter = express.Router();

// Middleware to check authentication (optional - works without auth)
const getAuthUserId = async (req: express.Request): Promise<string | undefined> => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user?.id;
  } catch (err) {
    return undefined;
  }
};

// GET /api/v1/curated-lists - Get all available curated lists
curatedListsRouter.get('/', async (req, res) => {
  try {
    const lists = curatedListsService.getLists();
    res.json(lists);
  } catch (err) {
    console.error('Failed to get curated lists:', err);
    res.status(500).json({ error: 'Failed to get curated lists' });
  }
});

// GET /api/v1/curated-lists/:listId - Get a specific curated list
curatedListsRouter.get('/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const list = curatedListsService.getList(listId);

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json(list);
  } catch (err) {
    console.error('Failed to get curated list:', err);
    res.status(500).json({ error: 'Failed to get curated list' });
  }
});

// GET /api/v1/curated-lists/:listId/items - Get items in a curated list
curatedListsRouter.get('/:listId/items', async (req, res) => {
  try {
    const { listId } = req.params;
    const userId = await getAuthUserId(req);

    let items = [];

    switch (listId) {
      case 'imdb-top-250-movies':
        items = await curatedListsService.getIMDBTop250Movies(userId);
        break;

      case 'imdb-top-250-tv':
        items = await curatedListsService.getIMDBTop250TV(userId);
        break;

      default:
        return res.status(404).json({ error: 'List not found' });
    }

    res.json({
      list_id: listId,
      items,
      total: items.length
    });
  } catch (err) {
    console.error('Failed to get curated list items:', err);
    res.status(500).json({ error: 'Failed to get curated list items' });
  }
});
