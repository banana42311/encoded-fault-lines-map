// =======================
// 0. 기본 지도 세팅
// =======================

// 지도 생성 (런던 중심)
const map = L.map("map").setView([51.5074, -0.1278], 12);

// 배경 타일 (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// 애니메이션용 포인트 상태들을 저장할 배열
const animatedPoints = [];
const measurements = [];

// =======================
// 1. Latency → 색상 매핑
// =======================

function latencyToColor(latency) {
  if (latency <= 40) return "#1a9850";   // 초록 - 빠름
  if (latency <= 80) return "#fee08b";   // 노랑 - 보통
  if (latency <= 150) return "#fc8d59";  // 주황 - 느림
  return "#d73027";                      // 빨강 - 매우 느림
}


// =======================
// 2. 포인트 하나 추가하는 함수
//    (여기서 latency 색 + jitter/packetLoss 애니메이션 상태를 등록)
// =======================

function addMeasurementPoint(m) {
  const color = latencyToColor(m.latency);

   measurements.push(m);

  // 기본 점 (latency 색)
  const baseCircle = L.circleMarker([m.lat, m.lng], {
    radius: 6,
    color: color,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 1,
  }).addTo(map);

  // 애니메이션 상태 저장
  const state = {
    baseRadius: 6,
    jitter: m.jitter,             // ms
    packetLoss: m.packetLoss,     // 0~1 (0~100%)
    t0: performance.now(),        // 시작 시각
    circle: baseCircle,
  };

  animatedPoints.push(state);

  // 팝업 정보
  baseCircle.bindPopup(
    `Latency: ${m.latency} ms<br>
     Jitter: ${m.jitter} ms<br>
     Packet loss: ${(m.packetLoss * 100).toFixed(1)} %`
  );
}


// =======================
// 3. Jitter → 반경 "두근두근" 애니메이션
// =======================

function updateJitterAnimation(state, now) {
  const elapsed = (now - state.t0) / 1000; // 초 단위 경과 시간

  // jitter(ms)를 0~1 범위로 스케일링 (최대 100ms 기준)
  const j = Math.min(state.jitter / 100, 1); // 0~1로 클램프

  const amplitude = 1 + 4 * j;       // jitter 클수록 맥동 폭 커짐
  const frequency = 0.5 + 2 * j;     // jitter 클수록 더 자주 두근거림

  const radiusOffset = amplitude * Math.sin(2 * Math.PI * frequency * elapsed);
  const newRadius = state.baseRadius + radiusOffset;

  state.circle.setRadius(newRadius);
}


// =======================
// 4. Packet loss → 깜빡임 (존재/부재 애니메이션)
// =======================

function updatePacketLossAnimation(state, now) {
  const period = 1000; // 1초 주기
  const loss = Math.max(0, Math.min(state.packetLoss, 1)); // 0~1로 클램프

  const visibleRatio = 1 - loss;  // loss 높을수록 덜 보임
  const tInPeriod = (now - state.t0) % period;
  const threshold = period * visibleRatio;

  const isVisible = tInPeriod < threshold;

  state.circle.setStyle({
    opacity: isVisible ? 1 : 0,
    fillOpacity: isVisible ? 0.9 : 0,
  });
}


// =======================
// 5. 모든 포인트에 대해 매 프레임 애니메이션 업데이트
// =======================

function animate() {
  const now = performance.now();

  for (const state of animatedPoints) {
    updateJitterAnimation(state, now);
    updatePacketLossAnimation(state, now);
  }

  requestAnimationFrame(animate);
}

// 애니메이션 루프 시작
requestAnimationFrame(animate);


// =======================
// 6. 테스트용: 지도 클릭하면 랜덤 값으로 포인트 추가
//    (나중에 실제 측정값으로 바꿀 예정)
// =======================

map.on("click", function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

map.on("click", function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const latencyInput = prompt("Latency (ms)을 입력해주세요:", "80");
  if (latencyInput === null) return;
  const latency = parseFloat(latencyInput);

  const jitterInput = prompt("Jitter (ms)을 입력해주세요:", "20");
  if (jitterInput === null) return;
  const jitter = parseFloat(jitterInput);

  const lossInput = prompt("Packet loss (%)를 입력해주세요:", "0");
  if (lossInput === null) return;
  const packetLoss = parseFloat(lossInput) / 100; // 0~1로 변환

  if (isNaN(latency) || isNaN(jitter) || isNaN(packetLoss)) {
    alert("숫자를 제대로 입력해주세요.");
    return;
  }

  const m = { lat, lng, latency, jitter, packetLoss };
  addMeasurementPoint(m);         // 점 + 애니메이션
  recomputeBuildingStyles();      // 건물 평균 다시 계산 & 색 갱신
});


  const m = { lat, lng, latency, jitter, packetLoss };
  addMeasurementPoint(m);

  console.log("Added point:", m);
});


// =======================
// 7. 테스트용: Barbican 근처에 샘플 포인트 2개
// =======================

addMeasurementPoint({
  lat: 51.5202,
  lng: -0.0978,
  latency: 40,
  jitter: 5,
  packetLoss: 0.0,   // 거의 완벽
});

addMeasurementPoint({
  lat: 51.519,
  lng: -0.095,
  latency: 180,
  jitter: 60,
  packetLoss: 0.6,   // 많이 끊김
});
// =======================
function attachAvgLatencyToBuildings(geojson) {
  geojson.features.forEach((feature) => {
    // 이 건물(폴리곤)의 geometry
    const poly = feature;

    // 이 폴리곤 안에 들어있는 포인트들만 필터링
    const insidePoints = measurements.filter((m) =>
      turf.booleanPointInPolygon(
        [m.lng, m.lat],   // 포인트 (lng, lat 순서!)
        poly              // 폴리곤 Feature
      )
    );

    if (insidePoints.length === 0) {
      // 아무 포인트도 없으면 avg_latency 지정 안 함
      return;
    }

    // 평균 latency 계산
    const sum = insidePoints.reduce((acc, p) => acc + p.latency, 0);
    const avg = sum / insidePoints.length;

    // properties에 저장
    if (!feature.properties) feature.properties = {};
    feature.properties.avg_latency = avg;
  });

  return geojson;
}

// =======================

fetch("data/barbican_buildings.geojson")
  .then((response) => response.json())
  .then((geojson) => {
    // 1) 포인트 기반으로 avg_latency 계산해서 properties에 붙이기
    const enriched = attachAvgLatencyToBuildings(geojson);

    // 2) avg_latency를 이용해서 색 칠하기
    const buildingLayer = L.geoJSON(enriched, {
      style: (feature) => {
        const avgLatency = feature.properties?.avg_latency;

        const fillColor =
          typeof avgLatency === "number"
            ? latencyToColor(avgLatency)
            : "#eeeeee"; // 측정값 없는 건물은 연한 회색

        return {
          color: "#111111",
          weight: 1,
          fillColor: fillColor,
          fillOpacity: 0.7,
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        layer.bindPopup(
          `<strong>${p.name || "Building"}</strong><br/>
           Avg latency: ${
             typeof p.avg_latency === "number"
               ? p.avg_latency.toFixed(1) + " ms"
               : "no data"
           }`
        );
      },
    }).addTo(map);

    console.log("Building layer with avg_latency:", buildingLayer);
  })
  .catch((err) => {
    console.error("Failed to load Barbican buildings GeoJSON:", err);
  });
addMeasurementPoint({
  lat: 51.5202,
  lng: -0.0978,
  latency: 40,
  jitter: 10,
  packetLoss: 0.1,
});

addMeasurementPoint({
  lat: 51.5203,
  lng: -0.0977,
  latency: 120,
  jitter: 30,
  packetLoss: 0.4,
});
