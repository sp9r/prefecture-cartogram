// デフォルトのモックデータ
const defaultData = [
    { prefecture: "北海道", value: 100 },
    { prefecture: "東京都", value: 150 },
    { prefecture: "大阪府", value: 120 }
];

let topoJsonData = null;
let currentData = defaultData;
let cartogramChart = null;

const container = document.getElementById('map-container');
const statusText = document.getElementById('status-text');

// 色のスケール設定 (値に応じて色を変える)
const colorScale = d3.scaleSequential(d3.interpolateBlues);

function init() {
    // TopoJSONデータの読み込み
    statusText.textContent = "地図データを読み込み中...";
    
    // ローカルまたはリモートのTopoJSONを読み込む
    d3.json('japan.topojson')
        .catch(() => d3.json('https://raw.githubusercontent.com/dataofjapan/land/master/japan.topojson'))
        .then(data => {
            topoJsonData = data;
            
            // 初回のCSV読み込み（ローカルファイルがあれば読み込む）
            return d3.csv('data.csv').catch(() => defaultData);
        })
        .then(csvData => {
            if (Array.isArray(csvData) && csvData.length > 0 && csvData[0].value !== undefined) {
                // 文字列から数値への変換
                currentData = csvData.map(d => ({
                    prefecture: d.prefecture,
                    value: +d.value
                }));
            }
            
            drawCartogram();
            
            // ウィンドウリサイズ対応
            window.addEventListener('resize', () => {
                if (cartogramChart) {
                    cartogramChart.width(container.clientWidth).height(container.clientHeight);
                }
            });
        })
        .catch(error => {
            console.error("エラーが発生しました:", error);
            statusText.textContent = "エラー: " + error.message;
            statusText.style.color = "red";
        });

    // CSVアップロード処理
    document.getElementById('csv-upload').addEventListener('change', handleFileUpload);
}

function drawCartogram() {
    if (!topoJsonData || !currentData) return;

    statusText.textContent = "カルトグラムを計算中... (数秒かかる場合があります)";
    
    // データを検索しやすくするためのMapを作成
    const valueMap = new Map();
    let maxVal = 0;
    
    currentData.forEach(d => {
        valueMap.set(d.prefecture, d.value);
        if (d.value > maxVal) maxVal = d.value;
    });
    
    colorScale.domain([0, maxVal]);

    // cartogram-chartの初期化または更新
    setTimeout(() => {
        try {
            if (!cartogramChart) {
                cartogramChart = Cartogram()
                    .topoJson(topoJsonData)
                    .topoObjectName('japan')
                    .width(container.clientWidth)
                    .height(container.clientHeight)
                    // 値が0や極端に小さいと計算エラーになるため、最小値を保証する
                    .value(d => {
                        const pref = d.properties.nam_ja;
                        const val = valueMap.get(pref);
                        return (val !== undefined && val > 0) ? val : 0.1;
                    })
                    .color(d => {
                        const pref = d.properties.nam_ja;
                        const val = valueMap.get(pref);
                        return val ? colorScale(val) : '#334155';
                    })
                    .label(d => {
                        const pref = d.properties.nam_ja;
                        const val = valueMap.get(pref) || 0;
                        return `${pref}: ${val}`;
                    })
                    // スタイリング
                    .projection(d3.geoMercator().center([137.0, 38.2]).scale(container.clientHeight * 2.5))
                    (container);
            } else {
                cartogramChart
                    .value(d => {
                        const pref = d.properties.nam_ja;
                        const val = valueMap.get(pref);
                        return (val !== undefined && val > 0) ? val : 0.1;
                    })
                    .color(d => {
                        const pref = d.properties.nam_ja;
                        const val = valueMap.get(pref);
                        return val ? colorScale(val) : '#334155';
                    });
            }
            statusText.textContent = "描画完了！";
            statusText.style.color = "#4ade80"; // green
        } catch (error) {
            console.error("カルトグラムの生成に失敗しました:", error);
            statusText.textContent = "描画エラー（値の分散が大きすぎる可能性があります）";
            statusText.style.color = "red";
        }
    }, 100); // UIスレッドを解放してローディングメッセージを表示させる
}

// CSVファイル読み込み処理
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = file.name;
    statusText.textContent = "CSVを読み込み中...";
    statusText.style.color = "var(--accent)";

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const parsedData = d3.csvParse(text, d => {
                return {
                    prefecture: d.prefecture,
                    value: +d.value // 数値に変換
                };
            });
            
            // バリデーション
            if (parsedData.length > 0 && parsedData[0].prefecture !== undefined && parsedData[0].value !== undefined && !isNaN(parsedData[0].value)) {
                currentData = parsedData;
                drawCartogram();
            } else {
                alert("CSVのフォーマットが正しくありません。\nヘッダーは「prefecture,value」である必要があります。");
            }
        } catch (error) {
            console.error(error);
            alert("CSVのパース中にエラーが発生しました。");
        }
    };
    reader.readAsText(file);
}

// 初期化実行
init();
