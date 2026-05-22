import fs from 'node:fs/promises';
import path from 'node:path';

const activities = [
  [1, '周杰伦 嘉年华 世界巡回演唱会 北京站 海报'],
  [2, '五月天 回到那一天 巡回演唱会 上海站 海报'],
  [3, '华语音乐联合演唱会 广州站 海报'],
  [4, '开心麻花 乌龙山伯爵 北京站 海报'],
  [5, '歌剧 茶花女 上海站 海报'],
  [6, '孟京辉 恋爱的犀牛 成都站 海报'],
  [7, '郭艾伦 篮球明星挑战赛 成都站 海报'],
  [8, 'LPL 英雄联盟 职业联赛 总决赛 深圳站 海报'],
  [9, '中国田径协会 城市路跑嘉年华 西安站 海报'],
  [10, '中国儿童艺术剧院 小王子 儿童剧 成都站 海报'],
  [11, '科学队长 亲子科学实验秀 杭州站 海报'],
  [12, '广州长隆 国际大马戏 南京站 海报'],
  [13, 'teamLab 数字艺术 沉浸展 武汉站 海报'],
  [14, '故宫博物院 国风 生活美学展 重庆站 海报'],
  [15, '中国摄影家协会 城市影像 艺术展 重庆站 海报'],
  [16, '中国爱乐乐团 室内乐 音乐会 杭州站 海报'],
  [17, '上海交响乐团 新年音乐会 南京站 海报'],
  [18, '李泉 爵士流行音乐会 广州站 海报'],
  [19, '德云社 相声大会 北京站 海报'],
  [20, '上海评弹团 经典评弹雅集 上海站 海报'],
  [21, '笑果文化 脱口秀 周末秀 重庆站 海报'],
  [22, '陶身体剧场 现代舞 13 深圳站 海报'],
  [23, '中央芭蕾舞团 天鹅湖 成都站 海报'],
  [24, '中国歌剧舞剧院 舞剧 李白 西安站 海报'],
  [25, '初音未来 未来有你 演唱会 上海站 海报'],
  [26, 'Bilibili 二次元 电竞嘉年华 深圳站 海报'],
  [27, '山口胜平 声优见面会 南京站 海报'],
  [28, '乌镇 江南水乡 旅行节 海报'],
  [29, '成都非遗博览园 体验展 海报'],
  [30, '中国旅游集团 丝路城市旅游展 西安 海报'],
];

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  Referer: 'https://image.baidu.com/',
};

function baiduImageUrl(query) {
  const params = new URLSearchParams({
    tn: 'resultjson_com',
    ipn: 'rj',
    ct: '201326592',
    is: '',
    fp: 'result',
    queryWord: query,
    cl: '2',
    lm: '-1',
    ie: 'utf-8',
    oe: 'utf-8',
    word: query,
    pn: '0',
    rn: '12',
  });
  return `https://image.baidu.com/search/acjson?${params}`;
}

function candidateUrls(item) {
  return [item.objURL, item.middleURL, item.hoverURL, item.thumbURL].filter((url) => typeof url === 'string' && /^https?:\/\//.test(url));
}

async function downloadImage(url, target) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!contentType.includes('image') || buffer.length < 2048) {
    throw new Error(`不是有效图片：${contentType || 'unknown'} ${buffer.length} bytes`);
  }
  await fs.writeFile(target, buffer);
}

async function main() {
  const outputDir = path.resolve('frontend/public/seed-posters');
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];
  for (const [id, query] of activities) {
    const name = String(id).padStart(2, '0');
    const target = path.join(outputDir, `activity-${name}.jpg`);
    try {
      const searchResponse = await fetch(baiduImageUrl(query), { headers, signal: AbortSignal.timeout(30000) });
      const raw = await searchResponse.text();
      const json = JSON.parse(raw.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
      const urls = (json.data || []).flatMap(candidateUrls);
      let downloadedUrl = null;
      for (const url of urls) {
        try {
          await downloadImage(url, target);
          downloadedUrl = url;
          break;
        } catch {
          // 继续尝试下一个候选图。
        }
      }
      if (downloadedUrl) {
        results.push(`OK ${name} ${downloadedUrl}`);
      } else {
        results.push(`MISS ${name} ${query}`);
      }
    } catch (error) {
      results.push(`MISS ${name} ${query} :: ${error.message}`);
    }
  }

  console.log(results.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
