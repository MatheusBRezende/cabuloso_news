const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const app = express();

app.use(cors());

app.get("/api/noticias-espn", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });
    const page = await browser.newPage();
    await page.goto("https://www.espn.com.br/futebol/time/_/id/2022/cruzeiro", {
      waitUntil: "networkidle2",
    });
    const html = await page.content();
    await browser.close();

    const $ = cheerio.load(html);
    const noticias = [];

    $("article.contentItem").each((i, el) => {
      const a = $(el).find("a.AnchorLink").first();
      const title = a.find(".contentItem__title").text().trim();
      const url = a.attr("href") || "";
      const description = a.find(".contentItem__subhead").text().trim();

      let image = $(el).find("figure source").first().attr("srcset");
      if (!image) image = $(el).find("figure img").first().attr("src");
      if (!image) image = $(el).find("img").first().attr("src");

      if (title && url) {
        noticias.push({
          title,
          url: url.startsWith("http") ? url : `https://www.espn.com.br${url}`,
          description,
          image: image || null,
        });
      }
    });

    res.json(noticias);
  } catch (err) {
    console.error("Erro detalhado no scraper:", err);
    res.status(500).json({ error: "Erro ao buscar notícias da ESPN" });
  }
});

const PORT = 4001;
app.listen(PORT, () => console.log("Scraper rodando na porta", PORT));
