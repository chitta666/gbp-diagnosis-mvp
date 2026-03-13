import { ymdTokyo } from "./date.js";
import { saveSnapshot } from "./snapshot.js";

export async function runDailyForPlace({ KV, key, myPlaceId }) {
  const rawComp = await KV.get(`comp:${myPlaceId}`);
  if (!rawComp) {
    return {
      ok: false,
      error: "COMPETITOR_NOT_SET",
      myPlaceId,
    };
  }

  const comp = JSON.parse(rawComp);
  const competitorPlaceId = comp.competitorPlaceId;

  const my = await saveSnapshot({ KV, key, placeId: myPlaceId });
  const competitor = await saveSnapshot({ KV, key, placeId: competitorPlaceId });

  return {
    ok: true,
    today: ymdTokyo(),
    myPlaceId,
    competitorPlaceId,
    my,
    competitor,
  };
}
