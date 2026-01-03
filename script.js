/**
 * VisualizationApp: Neolithic Painted Pottery Narrative (Enhanced)
 * Features: Circular Markers, Advanced Analytics, Scrollytelling
 */
class VisualizationApp {
    constructor() {
        this.data = null;
        this.chart = null;
        this.sankeyChart = null;
        this.parallelChart = null;

        // State
        this.state = {
            mode: 'story', // 'story' or 'explore'
            filterShape: 'all',
            mapMode: 'count',
            activeCity: null,
            activeItem: null,
            showAnalytics: false,
            timelineEra: 'all'
        };

        // Constants
        this.colors = {
            primary: '#8d6e63',
            secondary: '#d7ccc8',
            accent: '#3e2723',
            bg: '#f5f5f0',
            heatmap: ['#efebe9', '#d7ccc8', '#a1887f', '#8d6e63', '#5d4037', '#3e2723']
        };

        this.cityCoords = {
            "济南市": [117.000923, 36.675807],
            "青岛市": [120.355173, 36.082982],
            "淄博市": [118.047648, 36.814939],
            "枣庄市": [117.557964, 34.856424],
            "东营市": [118.4963, 37.461266],
            "烟台市": [121.391382, 37.539297],
            "潍坊市": [119.107078, 36.696951],
            "济宁市": [116.59118, 35.39065],
            "泰安市": [117.129063, 36.194968],
            "威海市": [122.116394, 37.509691],
            "日照市": [119.461208, 35.428588],
            "临沂市": [118.326443, 35.065282],
            "德州市": [116.307428, 37.453968],
            "聊城市": [115.980367, 36.456013],
            "滨州市": [118.016974, 37.383542],
            "菏泽市": [115.469381, 35.246531]
        };
    }

    async init() {
        try {
            const [dataRes, geoRes] = await Promise.all([
                fetch('data.json'),
                fetch('370000_full.json')
            ]);

            this.data = await dataRes.json();
            const shandongGeo = await geoRes.json();

            // PROXY FIX: Use i0.wp.com (WordPress Photon) for HTTPS support and CORS
            const proxyImage = (url) => {
                if (!url) return url;

                let cleanUrl = url.trim();

                // Skip if already proxied or local/data URI
                if (cleanUrl.includes('i0.wp.com') || cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
                    return cleanUrl;
                }

                // FORCE PROXY: Replace http:// or https:// with https://i0.wp.com/
                // This forces the image to be loaded via WordPress's global CDN
                // e.g. http://www.wwsdw.net/img.jpg -> https://i0.wp.com/www.wwsdw.net/img.jpg
                return cleanUrl.replace(/^https?:\/\//i, "https://i0.wp.com/");
            };

            // Apply proxy to all items
            if (this.data.all_items) {
                this.data.all_items.forEach(item => {
                    item.imgUrl = proxyImage(item.imgUrl);
                });
            }
            // Apply proxy to protagonist
            if (this.data.protagonist && this.data.protagonist.info) {
                this.data.protagonist.info.imgUrl = proxyImage(this.data.protagonist.info.imgUrl);
            }

            // PRE-PROCESS: Convert images to Circular Data URLs for Map
            await this.preloadCircularImages();

            echarts.registerMap('shandong', shandongGeo);

            this.chart = echarts.init(document.getElementById('map'));

            // Map Events
            this.chart.on('click', (params) => {
                if (params.componentType === 'series') {
                    if (params.seriesType === 'scatter') {
                        this.highlightItem(params.data.originalItem);
                    }
                }
            });

            // Initial Renders (Behind scenes)
            this.renderFilters();
            this.renderMap();
            this.renderGallery();

            // Story Mode Setup
            this.initStoryMode();

            window.addEventListener('resize', () => {
                this.chart && this.chart.resize();
                if (this.sankeyChart) this.sankeyChart.resize();
                if (this.parallelChart) this.parallelChart.resize();
            });

        } catch (e) {
            console.error(e);
            alert("初始化失败: " + e.message);
        }
    }

    // --- Image Helper ---
    async preloadCircularImages() {
        const promises = this.data.all_items.map(async (item) => {
            try {
                item.circleImgUrl = await this.getCircleImage(item.imgUrl);
            } catch (e) {
                console.warn("Failed to process image for", item.name);
                item.circleImgUrl = item.imgUrl; // Fallback
            }
        });
        await Promise.all(promises);
    }

    getCircleImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height);
                // Create higher resolution canvas for retina displays
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                // Draw Circle Clip
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                // Draw Image centered
                ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);

                // Add a border (optional, fits the theme)
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
                ctx.strokeStyle = '#8d6e63';
                ctx.lineWidth = size * 0.05; // 5% border
                ctx.stroke();

                resolve(canvas.toDataURL());
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // --- Story Mode Logic ---

    initStoryMode() {
        const p = this.data.protagonist.info;
        document.getElementById('story-protagonist-name').innerText = p.name;
        document.getElementById('story-protagonist-img').src = p.imgUrl;
        document.getElementById('story-protagonist-desc').innerText = p.description || "暂无描述";

        document.getElementById('story-family-count').innerText = this.data.city_details[p.city] ? this.data.city_details[p.city].total_count : '-';
        document.getElementById('story-family-city').innerText = p.city;

        const scroller = document.getElementById('story-scroller');
        const sections = document.querySelectorAll('.story-section');

        scroller.addEventListener('scroll', () => {
            sections.forEach(section => {
                const rect = section.getBoundingClientRect();
                if (rect.top >= 0 && rect.top < window.innerHeight * 0.5) {
                    const step = parseInt(section.dataset.step);
                    this.updateStoryStep(step);
                }
            });
        });
    }

    updateStoryStep(step) {
        if (this.state.mode !== 'story') return;

        switch (step) {
            case 1: // Intro
                this.chart.setOption({ geo: { zoom: 1.1, center: null } });
                break;
            case 2: // Identity
                break;
            case 3: // World
                // Show protagonist's type only
                const p = this.data.protagonist.info;
                this.state.filterShape = p.shape_type;
                this.renderMap();
                break;
            case 4: // Transition
                break;
        }
    }

    enterExploreMode() {
        this.state.mode = 'explore';

        const storyOverlay = document.getElementById('story-overlay');
        storyOverlay.style.opacity = '0';
        setTimeout(() => storyOverlay.style.display = 'none', 1000);

        const exploreUI = document.getElementById('explore-interface');
        exploreUI.style.opacity = '1';
        exploreUI.style.pointerEvents = 'auto';

        document.getElementById('explore-sidebar').classList.remove('-translate-x-full');
        document.getElementById('explore-controls').classList.remove('translate-x-full');
        document.getElementById('explore-legend').style.opacity = '1';

        this.state.filterShape = 'all';
        this.renderMap();
        this.renderGallery();
    }

    updateTimeline(val) {
        const labels = ['all', '大汶口', '龙山'];
        this.state.timelineEra = labels[val] === 'all' ? 'all' : labels[val];
        this.state.activeItem = null; // Clear selection when time traveling
        this.renderMap();
        this.renderGallery();
        if (this.state.showAnalytics) this.updateAnalytics();
    }

    // --- Logic: Analytics ---

    toggleAnalytics() {
        this.state.showAnalytics = !this.state.showAnalytics;
        const panel = document.getElementById('analytics-panel');
        if (this.state.showAnalytics) {
            panel.classList.remove('h-0');
            panel.classList.add('h-[400px]');
            // Wait for transition to complete so containers have width/height
            setTimeout(() => {
                this.updateAnalytics();
            }, 750);
        } else {
            panel.classList.remove('h-[400px]');
            panel.classList.add('h-0');
        }
    }

    updateAnalytics() {
        // Resize existing charts to fit new container dimensions
        if (this.sankeyChart) this.sankeyChart.resize();
        if (this.parallelChart) this.parallelChart.resize();

        this.renderSankey();
        this.renderParallel();
    }

    // --- Helper: Get Era from Item ---
    getEra(item) {
        const text = (item.yearName + item.name + item.description).toLowerCase();
        if (text.includes('大汶口')) return '大汶口文化';
        if (text.includes('龙山')) return '龙山文化';
        if (text.includes('岳石')) return '岳石文化';
        if (text.includes('新石器')) return '新石器时代(通用)';
        return '其他';
    }

    renderSankey() {
        const container = document.getElementById('chart-sankey');
        if (!container) return;

        // Ensure container has height
        if (container.clientHeight === 0) {
            container.style.height = '100%';
        }

        if (!this.sankeyChart) this.sankeyChart = echarts.init(container);
        this.sankeyChart.resize(); // Resize immediately to be safe

        // Construct 3-Level Sankey Data: Era -> City -> Shape
        const items = this.data.all_items;

        // Use a map to track unique nodes and their categories to avoid name collisions
        // Format: "Category:Name"
        const nodes = new Set();
        const linksMap = {};

        items.forEach(item => {
            const era = `Era:${this.getEra(item)}`;
            const city = `City:${item.city}`;
            const shape = `Shape:${item.shape_type}`;

            nodes.add(era);
            nodes.add(city);
            nodes.add(shape);

            // Era -> City
            const key1 = `${era}|${city}`;
            linksMap[key1] = (linksMap[key1] || 0) + 1;

            // City -> Shape
            const key2 = `${city}|${shape}`;
            linksMap[key2] = (linksMap[key2] || 0) + 1;
        });

        const sankeyNodes = Array.from(nodes).map(n => {
            const [cat, name] = n.split(':');
            return { name: n, value: name }; // Display name without prefix
        });

        const sankeyLinks = Object.entries(linksMap).map(([key, val]) => {
            const [source, target] = key.split('|');
            return { source, target, value: val };
        });

        const option = {
            tooltip: {
                trigger: 'item',
                triggerOn: 'mousemove',
                formatter: (params) => {
                    if (params.dataType === 'node') {
                        return params.data.value; // Show clean name
                    }
                    const s = params.data.source.split(':')[1];
                    const t = params.data.target.split(':')[1];
                    return `${s} -> ${t}: ${params.data.value}`;
                }
            },
            series: [{
                type: 'sankey',
                data: sankeyNodes,
                links: sankeyLinks,
                emphasis: { focus: 'adjacency' },
                lineStyle: { color: 'source', curveness: 0.5 },
                itemStyle: { color: '#8d6e63', borderColor: '#5d4037' },
                label: {
                    color: '#5d4037',
                    fontSize: 10,
                    fontWeight: 'bold',
                    formatter: (params) => params.data.value // Show clean name
                },
                nodeGap: 8,
                layoutIterations: 32
            }]
        };
        this.sankeyChart.setOption(option);
    }

    renderParallel() {
        const container = document.getElementById('chart-parallel');
        if (!container) return;

        // Ensure container has height
        if (container.clientHeight === 0) {
            container.style.height = '100%';
        }

        if (!this.parallelChart) this.parallelChart = echarts.init(container);
        this.parallelChart.resize(); // Resize immediately

        // Prepare Data for Parallel Coords
        // Dimensions: Era (Categorical), Shape (Categorical), Popularity (Numerical)
        const eras = ['大汶口文化', '龙山文化', '岳石文化', '新石器时代(通用)', '其他'];
        const shapes = this.data.dimensions.shapes;

        const data = this.data.all_items.map(item => {
            const era = this.getEra(item);
            return [
                eras.indexOf(era),
                shapes.indexOf(item.shape_type),
                item.clickCounts || 0
            ];
        });

        const option = {
            parallelAxis: [
                { dim: 0, name: '时代', type: 'category', data: eras },
                { dim: 1, name: '器型', type: 'category', data: shapes },
                { dim: 2, name: '关注度', type: 'value' }
            ],
            parallel: {
                left: '5%', right: '10%', bottom: '10%', top: '20%',
                lineStyle: { width: 1, opacity: 0.5 }
            },
            series: {
                type: 'parallel',
                lineStyle: { width: 2, color: '#8d6e63' },
                data: data
            }
        };
        this.parallelChart.setOption(option);
    }

    // --- Logic: Filters & Map Mode ---

    renderFilters() {
        const container = document.getElementById('shape-filters');
        const shapes = ['all', ...this.data.dimensions.shapes];

        container.innerHTML = shapes.map(shape => `
            <button 
                class="px-4 py-1.5 text-xs font-bold rounded-full border transition transform hover:scale-105 ${this.state.filterShape === shape ? 'bg-[#8d6e63] text-white border-[#8d6e63] shadow-md' : 'bg-white text-[#5d4037] border-[#d7ccc8] hover:bg-[#efebe9]'}"
                onclick="window.app.setFilter('${shape}')"
            >
                ${shape === 'all' ? '全部' : shape}
            </button>
        `).join('');
    }

    setFilter(shape) {
        this.state.filterShape = shape;
        this.state.activeItem = null; // Clear selection when filtering
        this.renderFilters();
        this.renderMap();
        this.renderGallery();
    }

    setMapMode(mode) {
        this.state.mapMode = mode;

        const btnCount = document.getElementById('btn-mode-count');
        const btnClicks = document.getElementById('btn-mode-clicks');

        const activeClass = "flex-1 py-2 text-sm font-bold rounded-md shadow-sm bg-white text-[#5d4037] transition";
        const inactiveClass = "flex-1 py-2 text-sm font-bold rounded-md text-stone-500 hover:text-[#5d4037] transition";

        if (mode === 'count') {
            btnCount.className = activeClass;
            btnClicks.className = inactiveClass;
        } else {
            btnCount.className = inactiveClass;
            btnClicks.className = activeClass;
        }

        this.renderMap();
    }

    // --- Logic: Map Rendering ---

    renderMap() {
        let items = this.data.all_items;

        if (this.state.filterShape !== 'all') {
            items = items.filter(i => i.shape_type === this.state.filterShape);
        }

        if (this.state.timelineEra !== 'all') {
            items = items.filter(i => i.yearName && i.yearName.includes(this.state.timelineEra));
        }

        let displayItems = items.slice(0, 60);

        // EXCLUSIVE FILTER: If activeItem exists, only show it in the main scatter layer
        if (this.state.activeItem) {
            displayItems = [this.state.activeItem];
        }

        const scatterData = displayItems.map(item => {
            const baseCoords = this.cityCoords[item.city];
            if (!baseCoords) return null;

            const lng = baseCoords[0] + (Math.random() - 0.5) * 0.4;
            const lat = baseCoords[1] + (Math.random() - 0.5) * 0.3;

            return {
                name: item.name,
                value: [lng, lat],
                originalItem: item,
                // Use the pre-calculated CIRCULAR image
                symbol: `image://${item.circleImgUrl || item.imgUrl}`,
                symbolSize: 55 // Larger size
            };
        }).filter(i => i);

        // Same Name Distribution
        let sameNameData = [];
        if (this.state.activeItem) {
            const cities = this.data.name_distribution[this.state.activeItem.name] || [];
            sameNameData = cities.map(city => {
                const coords = this.cityCoords[city];
                if (!coords) return null;
                return {
                    name: city,
                    value: coords,
                    itemStyle: { color: '#d81b60', borderColor: '#fff', borderWidth: 2 },
                    symbolSize: 20
                };
            }).filter(i => i);
        }

        // Heatmap Data
        const cityCounts = {};
        items.forEach(i => {
            const val = this.state.mapMode === 'count' ? 1 : i.clickCounts;
            cityCounts[i.city] = (cityCounts[i.city] || 0) + val;
        });

        const heatmapData = Object.keys(this.cityCoords).map(city => ({
            name: city,
            value: cityCounts[city] || 0
        }));

        const maxVal = Math.max(...heatmapData.map(d => d.value), 1);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.seriesType === 'scatter') {
                        if (params.seriesName === '同名分布') return `同名文物分布点: ${params.name}`;
                        const i = params.data.originalItem;
                        return `<div class="font-bold">${i.name}</div><div class="text-xs text-gray-500">${i.museumName}</div>`;
                    }
                    return `${params.name}: ${params.value}`;
                },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#d7ccc8',
                textStyle: { color: '#3e2723' }
            },
            visualMap: {
                show: false,
                min: 0,
                max: maxVal,
                inRange: { color: this.colors.heatmap }
            },
            geo: {
                map: 'shandong',
                roam: true,
                zoom: 1.1,
                label: { show: true, color: '#4e342e', fontSize: 12, fontWeight: 'bold' },
                itemStyle: {
                    areaColor: '#efebe9',
                    borderColor: '#fff',
                    borderWidth: 1.5,
                    shadowColor: 'rgba(0, 0, 0, 0.1)',
                    shadowBlur: 10
                },
                emphasis: {
                    itemStyle: { areaColor: '#d7ccc8' }
                }
            },
            series: [
                {
                    type: 'map',
                    geoIndex: 0,
                    data: heatmapData
                },
                {
                    name: '同名分布',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: sameNameData,
                    rippleEffect: { brushType: 'stroke', scale: 4 },
                    zlevel: 1
                },
                {
                    name: '文物',
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    data: scatterData,
                    symbolSize: 55,
                    itemStyle: {
                        shadowBlur: 15,
                        shadowColor: 'rgba(0,0,0,0.4)'
                    },
                    emphasis: {
                        scale: 1.3,
                        label: { show: false }
                    },
                    zlevel: 2
                }
            ]
        };

        this.chart.setOption(option, true);
    }

    renderGallery() {
        let items = this.data.all_items;
        if (this.state.filterShape !== 'all') items = items.filter(i => i.shape_type === this.state.filterShape);
        if (this.state.timelineEra !== 'all') items = items.filter(i => i.yearName && i.yearName.includes(this.state.timelineEra));

        document.getElementById('list-count').innerText = items.length;
        document.getElementById('gallery-list').innerHTML = items.map(item => `
            <div class="cursor-pointer group flex flex-col items-center p-3 rounded-lg hover:bg-[#efebe9] transition ${this.state.activeItem && this.state.activeItem.name === item.name ? 'bg-[#efebe9] ring-2 ring-[#8d6e63]' : ''}"
                onclick="window.app.highlightItem(window.app.data.all_items.find(i => i.name === '${item.name}'))">
                <div class="w-28 h-28 mb-3 bg-stone-100 overflow-hidden rounded-full border-4 border-[#d7ccc8] group-hover:border-[#8d6e63] shadow-md transition-colors duration-300">
                    <img src="${item.imgUrl}" class="object-cover w-full h-full group-hover:scale-110 transition duration-500" loading="lazy">
                </div>
                <div class="text-sm font-bold text-[#4e342e] truncate w-full text-center">${item.name}</div>
                <div class="text-xs text-[#8d6e63] mt-1 font-medium">${item.city}</div>
            </div>
        `).join('');
    }

    highlightItem(item) {
        if (!item) return;
        this.state.activeItem = item;
        this.updateSpotlight(item);
        this.renderMap();
        this.renderGallery();
    }

    updateSpotlight(item) {
        document.getElementById('spot-img').src = item.imgUrl;
        document.getElementById('spot-title').innerText = item.name;
        document.getElementById('spot-museum').innerText = item.museumName;
        document.getElementById('spot-shape').innerText = item.shape_type;
        document.getElementById('spot-desc').innerText = item.description || "暂无详细描述";
    }
}

// Global Instance
window.app = new VisualizationApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
