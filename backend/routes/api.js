const express = require('express');
const router = express.Router();
const newsScraper = require('../services/newsScraper');
const espnScraper = require('../services/espnScraper');

// Iniciar scrapers
espnScraper.startScheduledUpdates();

// Rotas de notícias
router.get('/noticias-espn', newsScraper.getNews);
router.get('/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  res.json({ apiKey: apiKey || 'not-set' });
});

// Rotas ESPN
router.get('/espn/calendario', async (req, res) => {
  try {
    const data = espnScraper.getCachedData();
    res.json(data.calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/espn/ao-vivo', async (req, res) => {
  try {
    const data = espnScraper.getCachedData();
    res.json(data.liveMatches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/espn/minuto-a-minuto/:matchId', async (req, res) => {
  try {
    const details = await espnScraper.fetchMatchDetails(req.params.matchId);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;