

// .-------------------------------.
// |         ODD CONSTANTS         |
// '-------------------------------'
            
// global state
let map_layer = 'Precinct.';  // 'Cong. Dist.' or 'Precinct.'
let map_geoms = 'Polygons';   // 'Centroids', 'Polygons', 'Both'
let map_timeline = '2020';    // '2020' or '2023'
let map_hover = null;
let map_hover_pos = { x: 0, y: 0 };
let target_cd = 'all';          // clicked district
let flow_dir = 'both';          // i have buttons for this
let current_metric = 'VAP';     // track what metric is being displayed

const metric_descriptions = {
    'VAP': '<b>VAP Overall / Core Retention</b><br>On the map: Displays population density.<br>On the alluvial: Shows the percentage of an old district retained in a new district.',
    'partisan_lean': '<b>Partisan Lean</b><br>Displays the political leaning based on the 2020 election. Blue(<span class="dot b_11"></span>,<span class="dot b_12"></span>) indicates Democratic lean, Red(<span class="dot b_13"></span>,<span class="dot b_14"></span>) indicates Republican lean.',
    'turnout_rate': '<b>Turnout Rate</b><br>Shows the percentage of the Voting Age Population that cast a ballot. Teal(<span class="dot b_21"></span>) represents high turnout, Orange(<span class="dot b_22"></span>) represents low turnout.',
    'all_vap': '<b>VAP All Races</b><br>On the map: Displays the plurality demographic.<br>On the charts: Shows the proportional breakdown of Black(<span class="dot b_31"></span>), Asian(<span class="dot b_32"></span>), Native(<span class="dot b_33"></span>), and Hispanic(<span class="dot b_34"></span>) voting age populations.',
    'vap_black': '<b>VAP Black %</b><br>Isolates the Voting Age Population identifying as Black. Darker shades indicate higher concentrations.',
    'vap_aian': '<b>VAP Native %</b><br>Isolates the Voting Age Population identifying as Native American or Alaska Native. Darker shades indicate higher concentrations.',
    'vap_asian': '<b>VAP Asian %</b><br>Isolates the Voting Age Population identifying as Asian. Darker shades indicate higher concentrations.',
    'vap_nhpi': '<b>VAP Hispanic / NHPI %</b><br>Isolates the Voting Age Population identifying as Hispanic or Native Hawaiian/Pacific Islander. Darker shades indicate higher concentrations.'
};

// demographic color mapping
const demographics = [
    { key: 'vap_black', color: 'rgba(228, 26, 28, 0.7)' }, 
    { key: 'vap_asian', color: 'rgba(55, 126, 184, 0.7)' }, 
    { key: 'vap_aian',  color: 'rgba(77, 175, 74, 0.7)' }, 
    { key: 'vap_nhpi',  color: 'rgba(152, 78, 163, 0.7)' },
    { key: 'other',     color: 'rgba(150, 150, 150, 0.7)'}
];

// vap color grouping
const get_vap_color = (metric_name, opacity = 0.7) => {
    const colors = {
        'vap_black': `rgba(228, 26, 28, ${opacity})`,
        'vap_asian': `rgba(55, 126, 184, ${opacity})`,
        'vap_aian':  `rgba(77, 175, 74, ${opacity})`,
        'vap_nhpi':  `rgba(152, 78, 163, ${opacity})`
    };
    return colors[metric_name] || `rgba(74, 144, 226, ${opacity})`; 
};


// vap color shading
const get_vap_shade = (metric_name, percent, is_focused) => {
    const hs = {
        'vap_black': { h: 359, s: 80 }, // red
        'vap_asian': { h: 207, s: 54 }, // blue
        'vap_aian':  { h: 118, s: 41 }, // green
        'vap_nhpi':  { h: 292, s: 35 }  // purple ish?
    };

    let base = hs[metric_name] || { h: 210, s: 70 }; // backup color
    
    let p = Math.max(0, Math.min(1, percent));
    
    let lightness = 95 - (Math.sqrt(p) * 60);

    let saturation = base.s;
    if (!is_focused) {
        saturation *= 0.4;
        lightness = Math.min(95, lightness + 10);
    }

    return `hsl(${base.h}, ${saturation}%, ${lightness}%)`;
};

// generate very pretty turnout colors
const get_turnout_shade = (percent, is_focused) => {
    let normalized = (percent - 0.2) / 0.6; 
    let p = Math.max(0, Math.min(1, normalized)); 
    let h = 15 + (p * 170);
    let s = is_focused ? 75 : 30;
    let l = is_focused ? 50 : 85;
    
    return `hsl(${h}, ${s}%, ${l}%)`;
};

// get lean color blocks
const get_lean_color = (val, opacity = 0.7) => {
    if (val >= 0.15) return `rgba(33, 102, 172, ${opacity})`;   // DDD
    if (val >= 0.05) return `rgba(67, 147, 195, ${opacity})`;   // DD
    if (val > 0.01)  return `rgba(146, 197, 222, ${opacity})`;  // R
    if (val >= -0.01) return `rgba(247, 247, 247, ${opacity})`; // ?
    if (val >= -0.05) return `rgba(244, 165, 130, ${opacity})`; // R
    if (val >= -0.15) return `rgba(214, 96, 77, ${opacity})`;   // RR
    return `rgba(178, 24, 43, ${opacity})`;                     // RRR
};

const get_retention_shade = (flow_val, source_total_val, is_focused) => {
    let p = source_total_val > 0 ? flow_val / source_total_val : 0;
    let l = 95 - (p * 60); 
    let s = is_focused ? 65 : 20;
    return `hsl(280, ${s}%, ${l}%)`;
};

// get the color for a particular metric
const get_metric_color = (metric, row) => {
    let val = 0;
    if (metric === 'all_vap') {

        // color by majority/plurality demographic
        let max_k = 'vap_white'; let max_v = -1;
        let t_vap = row['VAP'] || 1;
        
        demographics.forEach(dem => {
            if (dem.key === 'other') {
                return;
            }

            let v = (row[dem.key.toUpperCase()] || 0) / t_vap;
            if (v > max_v) { 
                max_v = v; 
                max_k = dem.key; 
            }
        });
        
        return get_vap_shade(max_k, max_v, true);
    }
    
    if (metric === 'turnout_rate' || metric === 'partisan_lean') {
        val = row[metric] || 0;
    }
    
    else if (metric.startsWith('vap_')) {
        let col = metric.toUpperCase();
        val = (row['VAP'] > 0) ? (row[col] || 0) / row['VAP'] : 0;
    } 
    
    else if (metric === 'VAP') {
        val = row['VAP'] || 0; 
    }

    if (metric === 'turnout_rate') {
        return get_turnout_shade(val, true);
    }
    
    if (metric === 'partisan_lean') {
        return get_lean_color(val, 0.9);
    }
    
    if (metric.startsWith('vap_')) {
        return get_vap_shade(metric, val, true);
    }
    
    if (metric === 'VAP') {
        let p = val / (map_layer === 'Precinct.' ? 4000 : 800000);
        return `hsl(280, 65%, ${95 - Math.min(1, p) * 60}%)`;
    }

    return '#ccc';
};

// .--------------------------------.
// |         INITIALIZATION         |
// '--------------------------------'

let lookup_tables = {};
let ts = 'fl';

const init_lookup_tables = () => {
    
    lookup_tables['PCT_STD'] = {}
    lookup_tables['CD116FP'] = {}
    lookup_tables['CD118FP'] = {}
    
    for (let i in data[ts]) {
        let row = data[ts][i];

        lookup_tables['PCT_STD'][row['PCT_STD']] = i;
        lookup_tables['CD116FP'][row['CD116FP']] = i;
        lookup_tables['CD118FP'][row['CD118FP']] = i;
    }
}

let oscale = 100;

let xmax = -Infinity;
let ymax = -Infinity;
let xmin = Infinity;
let ymin = Infinity;

let geom_groups = {};

let main_cv = undefined;
let buffer = undefined;

let alluv_cv = undefined;
let boxes_cv = undefined;
let bars_cv = undefined;

const init_map = () => {
    
    // load all geoms
    console.log('loading precinct geoms...')
    load_geom_group(geom_pct[ts], 'PCT_STD');

    console.log('loading 2010\'s cycle geoms...')
    load_geom_group(geom_116[ts], 'CD116FP');
    
    console.log('loading 2020\'s cycle geoms...')
    load_geom_group(geom_118[ts], 'CD118FP');

    main_cv = document.getElementById('main_cv');
    main_ctx = main_cv.getContext('2d');
    buffer = document.getElementById('buff_cv');

    const new_width = window.innerWidth;
    const new_height = window.innerHeight;

    main_cv.width = new_width;
    main_cv.height = new_height;

    buffer.width = new_width;
    buffer.height = new_height;

    // get canvases for metric rendering
    alluv_cv = document.getElementById('alluv_cv');
    boxes_cv = document.getElementById('boxes_cv');
    bars_cv = document.getElementById('bars_cv');
    scale_cv = document.getElementById('scale_cv');
    boxes_cv = document.getElementById('boxes_cv');
    bars_cv = document.getElementById('bars_cv');
}

const load_state_data = () => {
    lookup_tables['PCT_STD'] = {};
    lookup_tables['CD116FP'] = {};
    lookup_tables['CD118FP'] = {};

    for (let i in data[ts]) {
        let row = data[ts][i];
        lookup_tables['PCT_STD'][row['PCT_STD']] = i;
        lookup_tables['CD116FP'][row['CD116FP']] = i;
        lookup_tables['CD118FP'][row['CD118FP']] = i;
    }

    geom_groups = {};
    load_geom_group(geom_pct[ts], 'PCT_STD');
    load_geom_group(geom_116[ts], 'CD116FP');
    load_geom_group(geom_118[ts], 'CD118FP');

    scale = 1.0;
    shift_x = 0; shift_y = 0;
    offset_x = -(window.innerWidth / 2);
    offset_y = -(window.innerHeight / 2);
}

const load_geom_group = (geom_df, key) => {
    
    // create geom group
    geom_groups[key] = {};

    // normalize our points so they don't have crazy values
    normalize_raw_data(geom_df, 5000)

    for (let geom of geom_df) {
        let mpoly = get_multipolygon(geom);

        let ikey = geom[key];
        
        geom_groups[key][ikey] = generate_lod_geoms(mpoly);
    }
}

// calculate the perpendicular distance from a point to a line segment
function sq_dist_to_segment(p, p1, p2) {
    let x = p1[0];
    let y = p1[1];
    let dx = p2[0] - x;
    let dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        
        if (t > 1) {
            x = p2[0]; y = p2[1];
        }  else if (t > 0) {
            x += dx * t; y += dy * t;
        }
    }

    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
}

// recursive RDP algo for poly simplification
// see Ramer-Douglas-Peucker algorithm for more info. 
function simplify_rdp(points, tolerance) {
    if (points.length <= 2) {
        return points;
    }

    let max_sq_dist = 0;
    let idx = 0;
    let end = points.length - 1;

    for (let i = 1; i < end; i++) {
        let sqDist = sq_dist_to_segment(points[i], points[0], points[end]);
        if (sqDist > max_sq_dist) {
            max_sq_dist = sqDist;
            idx = i;
        }
    }

    if (max_sq_dist > tolerance) {
        let left = simplify_rdp(points.slice(0, idx + 1), tolerance);
        let right = simplify_rdp(points.slice(idx), tolerance);
        return left.slice(0, left.length - 1).concat(right);
    }

    return [points[0], points[end]];
}

const get_multipolygon = (geom) => {
    if (geom.geometry.type === 'MultiPolygon') {
        return geom.geometry.coordinates;
    }
    
    else if (geom.geometry.type === 'Polygon') {
        return [geom.geometry.coordinates];
    }
    
    else if (geom.geometry.geometries) {
        let polys = [];
        
        for (let igeom of geom.geometry.geometries) {
            if (igeom.type === 'Polygon') {
                polys.push(igeom.coordinates);
            }
            if (igeom.type === 'MultiPolygon') {
                polys.push(...igeom.coordinates);
            }
        }

        return polys;
    }

    return [];
};

const normalize_raw_data = (raw, max_dim) => {
    
    // don't normalize the same map twice
    if (raw._normalized) {
        return raw;
    }

    let xmax = -Infinity, ymax = -Infinity, xmin = Infinity, ymin = Infinity;
    for (let geom of raw) {
        let mpoly = get_multipolygon(geom);
        for (let polygon of mpoly) {
            for (let ring of polygon) {
                for (let p of ring) {
                    if (p[0] > xmax) xmax = p[0];
                    if (p[1] > ymax) ymax = p[1];
                    if (p[0] < xmin) xmin = p[0];
                    if (p[1] < ymin) ymin = p[1];
                }
            }
        }
    }

    const g_width = xmax - xmin;
    const g_height = ymax - ymin;
    const cx = xmin + g_width / 2;
    const cy = ymin + g_height / 2;
    
    const max_g_dim = Math.max(g_width, g_height) || 1; 
    const ratio = max_dim / max_g_dim;

    for (let geom of raw) {
        let mpoly = get_multipolygon(geom);
        for (let polygon of mpoly) {
            for (let ring of polygon) {
                for (let p of ring) {
                    p[0] = (p[0] - cx) * ratio;
                    p[1] = -(p[1] - cy) * ratio;
                }
            }
        }
    }
    
    raw._normalized = true;
    return raw;
}

const generate_lod_geoms = (raw) => {
    
    let sx = 0;
    let sy = 0;
    let total = 0;

    for (let points of raw) {
        for (let p of points[0]) {
            sx += p[0];
            sy += p[1];
            total++;
        }
    }

    const cpoint = {
        x: total > 0 ? sx / total : 0,
        y: total > 0 ? sy / total : 0
    };

    let sq_radius = 0; 
    
    for (let points of raw) {
        for (let p of points[0]) {
            let dx = p[0] - cpoint.x;
            let dy = p[1] - cpoint.y;
            let sq_dist = dx * dx + dy * dy; // avoid sqrt for speed
            
            if (sq_dist > sq_radius) {
                sq_radius = sq_dist;
            }
        }
    }
    
    // now we apply the sqrt
    const radius = Math.sqrt(sq_radius);

    const lods = {
        high: new Path2D(),
        medium: new Path2D(),
        okay: new Path2D(),
        low: new Path2D(),
        xlow: new Path2D()
    }

    for (const points of raw) {
        build_path(lods.high, points[0]);
        build_path(lods.medium, simplify_rdp(points[0], 0.1));
        build_path(lods.okay, simplify_rdp(points[0], 1));
        build_path(lods.low, simplify_rdp(points[0], 2));
        build_path(lods.xlow, simplify_rdp(points[0], 20));
    }

    return {
        lods: lods,
        cpoint: cpoint,
        radius: radius
    };
}

const build_path = (path2D, points) => {
    if (points.length === 0) {
        return;
    }
    path2D.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
        path2D.lineTo(points[i][0], points[i][1]);
    }

    path2D.closePath();
}

const get_geom = (obj, attr) => {
    return geom_groups[attr][obj[attr]];
} 

// .---------------------------.
// |         RENDERING         |
// '---------------------------'

// create repeating pattern for NA polygons
const createNaPattern = (ctx) => {

    let stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 6;
    stripeCanvas.height = 6;
    let sctx = stripeCanvas.getContext('2d');

    // Fill background white
    sctx.fillStyle = 'black';
    sctx.fillRect(0, 0, 6, 6);

    // Draw diagonal stripe
    sctx.strokeStyle = '#3d3d3d';
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.moveTo(-3, 6);
    sctx.lineTo(6, -3);
    sctx.stroke();

    sctx.beginPath();
    sctx.moveTo(0, 9);     
    sctx.lineTo(9, 0);     
    sctx.stroke();

    return ctx.createPattern(stripeCanvas, 'repeat');
}

// helper to aggregate to precinct level
const get_cd_data = (cycle_col) => {
    let cd_data = {};

    data[ts].forEach(row => {
        let cd = row[cycle_col];

        if (!cd_data[cd]) {
            cd_data[cd] = { VAP: 0, total_2020_votes: 0, turnout_rate: 0, partisan_lean: 0 };
        }
        
        cd_data[cd].VAP += row['VAP'] || 0;
        cd_data[cd].total_2020_votes += row['total_2020_votes'] || 0;

        demographics.forEach(d => {
            if(d.key!=='other') {
                cd_data[cd][d.key.toUpperCase()] = (cd_data[cd][d.key.toUpperCase()] || 0) + (row[d.key.toUpperCase()] || 0);
            }
        });
        
        cd_data[cd].turnout_rate += (row['turnout_rate'] || 0) * (row['VAP'] || 0);
        cd_data[cd].partisan_lean += (row['partisan_lean'] || 0) * (row['total_2020_votes'] || 0);
    });
    
    for (let cd in cd_data) {
        if (cd_data[cd].VAP > 0) {
            cd_data[cd].turnout_rate /= cd_data[cd].VAP;
        }

        if (cd_data[cd].total_2020_votes > 0) {
            cd_data[cd].partisan_lean /= cd_data[cd].total_2020_votes;
        }
    }
    return cd_data;
};

const draw_map = () => {
    const ctx = buffer.getContext('2d');
    const naPattern = createNaPattern(ctx);

    let v_left = offset_x; let v_top = offset_y;
    let v_right = offset_x + (buffer.width / scale);
    let v_bottom = offset_y + (buffer.height / scale);

    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, buffer.width, buffer.height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-offset_x, -offset_y);

    ctx.lineWidth = 1 / scale;
    const metric = current_metric;
    const cycle_col = map_timeline === '2020' ? 'CD116FP' : 'CD118FP';

    // draw base layer
    if (map_layer === 'Precinct.') {
        for (let i = 0; i < data[ts].length; i++) {
            let row = data[ts][i];
            let geom = get_geom(row, 'PCT_STD');
            if(!geom) {
                continue;
            }

            let r = geom.radius, c = geom.cpoint;
            if ((c.x + r < v_left) || (c.x - r > v_right) || (c.y + r < v_top) || (c.y - r > v_bottom)) {
                continue;
            }

            let path = geom.lods.xlow; let sd = r * 2 * scale;
            if (sd > 200) {
                path = geom.lods.high;
            } 
            
            else if (sd > 30) {
                path = geom.lods.medium;
            }
            
            else if (sd > 20) {
                path = geom.lods.okay;
            } 
             
            else if (sd > 5) {
                path = geom.lods.low;
            }

            let color = get_metric_color(metric, row);

            if (map_geoms === 'Polygons' || map_geoms === 'Both') {
                ctx.fillStyle = (map_geoms === 'Both') ? 'rgba(50,50,50,0.3)' : color;
                
                if (row.VAP === 0) {
                    ctx.fillStyle = naPattern;
                }
                
                ctx.fill(path);
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; 
                ctx.stroke(path);
            }
            if (map_geoms === 'Centroids' || map_geoms === 'Both') {
                ctx.beginPath(); 
                ctx.arc(c.x, c.y, 3 / scale, 0, Math.PI * 2);
                ctx.fillStyle = color; 
                ctx.fill();
            }
        }
    } 
    
    else {
        let cd_data = get_cd_data(cycle_col);
        for (let cd in cd_data) {
            let row = cd_data[cd];
            let geom = geom_groups[cycle_col][cd];
            if(!geom) continue;

            let r = geom.radius, c = geom.cpoint;
            if ((c.x + r < v_left) || (c.x - r > v_right) || (c.y + r < v_top) || (c.y - r > v_bottom)) continue;

            let path = geom.lods.xlow; let sd = r * 2 * scale;
            if (sd > 200) path = geom.lods.high; else if (sd > 30) path = geom.lods.medium; else if (sd > 20) path = geom.lods.okay; else if (sd > 5) path = geom.lods.low;

            let color = get_metric_color(metric, row);

            if (map_geoms === 'Polygons' || map_geoms === 'Both') {
                ctx.fillStyle = (map_geoms === 'Both') ? 'rgba(50,50,50,0.3)' : color;
                if (row.VAP === 0) ctx.fillStyle = naPattern;
                ctx.fill(path);
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke(path);
            }
            if (map_geoms === 'Centroids' || map_geoms === 'Both') {
                ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1 / scale, r * 0.2), 0, Math.PI * 2);
                ctx.fillStyle = color; ctx.fill();
            }
        }
    }

    // draw overlay and highlights
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    let overlay_geoms = geom_groups[cycle_col];
    
    for (let cd in overlay_geoms) {
        let geom = overlay_geoms[cd];
        let r = geom.radius, c = geom.cpoint;
        if ((c.x + r < v_left) || (c.x - r > v_right) || (c.y + r < v_top) || (c.y - r > v_bottom)) continue;
        
        let path = (r * 2 * scale > 200) ? geom.lods.high : geom.lods.medium;
        
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.stroke(path);
        
        ctx.lineWidth = 1.2 / scale;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.stroke(path);
        
        if (cd === target_cd) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fill(path);
            
            ctx.lineWidth = 4 / scale;
            ctx.strokeStyle = '#00e5ff'; 
            ctx.stroke(path);
        }
    }

    ctx.restore();
    
    // trigger alluvial chain
    render_alluvial();
}

const render_scale = (hovered_data = null) => {
    const metric = current_metric;
    const ctx = scale_cv.getContext('2d');
    ctx.clearRect(0, 0, scale_cv.width, scale_cv.height);
    
    let pad_x = 25; 
    let pad_y = 20;
    let sw = 20;
    let sh = scale_cv.height - (pad_y * 2);

    // all vap rendering
    if (metric === 'all_vap') {

        // fix clipping
        let legend_y = scale_cv.height - (demographics.length * 15) - 5; 
        let bar_h = legend_y - pad_y - 15;

        demographics.forEach((dem, i) => {
            ctx.fillStyle = dem.color.replace('0.7)', '1.0)'); 
            ctx.fillRect(pad_x, legend_y + (i * 15), 10, 10);
            ctx.fillStyle = '#ccc';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(dem.key.replace('vap_', '').toUpperCase(), pad_x + 15, legend_y + (i * 15));
        });
        
        if (hovered_data) {
            const draw_stacked_bar = (x, y, w, h, data_obj) => {
                let sections = demographics.map(d => ({ key: d.key, color: d.color, val: data_obj[d.key] || 0 }));
                
                // do not forget to calculate remainder correctly
                let accounted = 0;
                sections.forEach(s => {
                    if (s.key !== 'other') {
                        accounted += s.val;
                    }
                });

                let other_sec = sections.find(s => s.key === 'other');
                if (other_sec) other_sec.val = Math.max(0, 1.0 - accounted);

                let top_3_threshold = sections.map(s => s.val).sort((a, b) => b - a)[2] || 0;

                let cy = y;

                sections.forEach(sec => {
                    let section_h = sec.val * h;

                    if (section_h > 0.5) {
                        ctx.fillStyle = sec.key === 'other' ? 'rgba(200, 200, 200, 0.6)' : sec.color.replace('0.7)', '1.0)');
                        ctx.fillRect(x, cy, w, section_h);
                        
                        if (sec.val >= top_3_threshold && sec.val > 0.01) { 
                            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
                            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

                            ctx.fillText((sec.val * 100).toFixed(1) + '%', x + w + 5, cy + (section_h / 2));
                        }
                        
                        cy += section_h;
                    }
                });
            };

            let target_data = hovered_data.type === 'node' ? hovered_data.val : hovered_data.flow_val;
            
            draw_stacked_bar(pad_x + 5, pad_y, 25, bar_h, target_data);
            
            ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(hovered_data.type === 'node' ? 'DISTRICT' : 'FLOW', pad_x + 18, pad_y - 10);
        }
        return; 
    }

    // background scales
    if (metric === 'partisan_lean') {
        let box_h = sh / 7;
        let vals = [0.2, 0.1, 0.03, 0, -0.03, -0.1, -0.2]; 

        vals.forEach((v, i) => {
            ctx.fillStyle = get_lean_color(v, 1.0);
            ctx.fillRect(pad_x, pad_y + (i * box_h), sw, box_h);
        });
    } 
    
    else if (metric === 'turnout_rate') {
        let grad = ctx.createLinearGradient(0, pad_y, 0, pad_y + sh);

        for (let i = 0; i <= 1; i += 0.1) {
            grad.addColorStop(i, get_turnout_shade(0.8 - (i * 0.6), true));
        }
        
        ctx.fillStyle = grad;
        ctx.fillRect(pad_x, pad_y, sw, sh);
    } 
    
    else if (metric.startsWith('vap_')) {
        let grad = ctx.createLinearGradient(0, pad_y, 0, pad_y + sh);

        for (let i = 0; i <= 1; i += 0.1) {
            grad.addColorStop(i, get_vap_shade(metric, 1.0 - i, true));
        }

        ctx.fillStyle = grad;
        ctx.fillRect(pad_x, pad_y, sw, sh);
    } 
    
    else if (metric === 'VAP') {
        let grad = ctx.createLinearGradient(0, pad_y, 0, pad_y + sh);

        for (let i = 0; i <= 1; i += 0.1) {
            grad.addColorStop(i, `hsl(280, 65%, ${95 - (1.0 - i) * 60}%)`);
        }

        ctx.fillStyle = grad;
        ctx.fillRect(pad_x, pad_y, sw, sh);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('100% RETAIN', pad_x + sw / 2, pad_y - 10);
        ctx.fillText('SPLINTERED', pad_x + sw / 2, pad_y + sh + 10);
    } 
    
    else {
        return;
    }

    // Helper to get Y mapping
    const get_y = (val, is_raw_count = false) => {
        let p = 1.0 - val;
        
        if (metric === 'partisan_lean') {
            p = (0.25 - val) / 0.5;
        } 
        
        else if (metric === 'turnout_rate') {
            p = (0.8 - val) / 0.6;
        } 
        
        else if (metric === 'VAP' && is_raw_count) {
            let normalized = val / (map_layer === 'Precinct.' ? 4000 : 800000);
            p = 1.0 - normalized;
        } 
        
        // this else is likely redundant
        else {
            p = 1.0 - val;
        }
        
        return pad_y + (Math.max(0, Math.min(1, p)) * sh);
    };

    const format_val = (val, is_raw_count = false) => {
        if (metric === 'VAP' && is_raw_count) {
            return Math.round(val).toLocaleString(); 
        }

        let prefix = (metric === 'partisan_lean' && val > 0) ? '+' : '';
        
        return prefix + (val * 100).toFixed(1) + '%';
    };
    
    // map hover indicator
    if (map_hover) {
        let { metric_val } = extract_metric(map_hover, metric);
        let y = get_y(metric_val, true); 
        
        ctx.beginPath();
        ctx.moveTo(pad_x - 2, y); 
        ctx.lineTo(pad_x - 10, y - 6);
        ctx.lineTo(pad_x - 10, y + 6);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
    }

    // alluvial hover indicators
    if (hovered_data) {

        const draw_marker = (true_y, text_y, text, is_top, has_overlap) => {
            
            ctx.beginPath();
            ctx.moveTo(pad_x + sw + 2, true_y); 
            ctx.lineTo(pad_x + sw + 8, text_y - 5);
            ctx.lineTo(pad_x + sw + 8, text_y + 5);
            ctx.fillStyle = '#fff';
            ctx.fill();

            if (has_overlap) {
                ctx.font = is_top ? 'bold 14px sans-serif' : '10px sans-serif';
            }
            else ctx.font = 'bold 12px sans-serif';
            
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(text, pad_x + sw + 12, text_y);
        };

       if (hovered_data.type === 'node' || hovered_data.type === 'density') {
            let is_raw = (hovered_data.type === 'density'); 
            let y = get_y(hovered_data.val, is_raw);

            draw_marker(y, y, format_val(hovered_data.val, is_raw), false, false);
        }
        
        else if (hovered_data.type === 'link') {
            let sy = get_y(hovered_data.source_val, false);
            let ty = get_y(hovered_data.target_val, false);

            let is_source_top = sy <= ty;

            let top_true_y = is_source_top ? sy : ty; let bot_true_y = is_source_top ? ty : sy;

            let top_val = is_source_top ? hovered_data.source_val : hovered_data.target_val;
            let bot_val = is_source_top ? hovered_data.target_val : hovered_data.source_val;

            let overlap = Math.abs(bot_true_y - top_true_y) <= 22;
            let top_text_y = top_true_y; let bot_text_y = bot_true_y;

            if (overlap) {
                let mid = (top_true_y + bot_true_y) / 2;
                top_text_y = mid - 10; bot_text_y = mid + 10;
            }

            draw_marker(top_true_y, top_text_y, format_val(top_val), true, overlap);
            draw_marker(bot_true_y, bot_text_y, format_val(bot_val), false, overlap);

            if (overlap) {
                ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                
                let arrow = is_source_top ? '▼' : '▲';
                ctx.fillText(arrow, pad_x + sw + 12, (top_text_y + bot_text_y) / 2);
            } 
            
            else {
                let dir = Math.sign(ty - sy); 
                let arrow_x = pad_x + sw + 45;
                let arrow_start = sy + (dir * 12); let arrow_end = ty - (dir * 12);
                
                ctx.beginPath(); ctx.moveTo(arrow_x, arrow_start); ctx.lineTo(arrow_x, arrow_end);
                ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5; ctx.stroke();
                
                ctx.beginPath(); ctx.moveTo(arrow_x, arrow_end);
                ctx.lineTo(arrow_x - 3, arrow_end - (dir * 4)); ctx.lineTo(arrow_x + 3, arrow_end - (dir * 4));
                ctx.fillStyle = '#aaa'; ctx.fill();
            }
        }
    }
};


const extract_metric = (row, metric) => {
    let flow_size = 0; let metric_val = null; let is_all_vap = (metric === 'all_vap');

    if (metric === 'turnout_rate') { 
        flow_size = row['VAP'] || 0; 
        metric_val = Math.max(0, Math.min(1, row[metric] || 0)); 
    } 
    else if (metric === 'partisan_lean') { 
        flow_size = row['total_2020_votes'] || 0; 
        metric_val = Math.max(-1, Math.min(1, row[metric] || 0)); 
    } 
    else if (is_all_vap) {
        flow_size = row['VAP'] || 0;
        
        metric_val = {
            vap_black: flow_size > 0 ? Math.max(0, Math.min(1, (row['VAP_BLACK'] || 0) / flow_size)) : 0,
            vap_aian:  flow_size > 0 ? Math.max(0, Math.min(1, (row['VAP_AIAN'] || 0) / flow_size)) : 0,
            vap_asian: flow_size > 0 ? Math.max(0, Math.min(1, (row['VAP_ASIAN'] || 0) / flow_size)) : 0,
            vap_nhpi:  flow_size > 0 ? Math.max(0, Math.min(1, (row['VAP_NHPI'] || 0) / flow_size)) : 0
        };
    } 
    else if (metric.startsWith('vap_')) {
        let dem_col = metric.toUpperCase();

        flow_size = row[dem_col] || 0; 
        let total_vap = row['VAP'] || 0;
        
        metric_val = total_vap > 0 ? Math.max(0, Math.min(1, flow_size / total_vap)) : 0;
    } 
    else {
        metric_val = row[metric] || 0; flow_size = metric_val; 
    }
    
    return { flow_size, metric_val, total_vap: row['VAP'] || 0 };
};

// aux chart states
let aux_chart_state = { before: [], after: [], before_p: [], after_p: [], metric: '', target_cd: '', flow_dir: '' };
let aux_hit_regions = { boxes: [], bars: [] };
let aux_hover = { boxes: null, bars: null };

const render_aux_charts = (before_nodes, after_nodes, before_p_vals, after_p_vals, metric, target_cd, flow_dir) => {
    aux_chart_state = { before: before_nodes, after: after_nodes, before_p: before_p_vals, after_p: after_p_vals, metric, target_cd, flow_dir };
    
    const b_cv = boxes_cv;
    const c_cv = bars_cv;
    const b_ctx = b_cv.getContext('2d');
    const c_ctx = c_cv.getContext('2d');
    
    let bw = b_cv.width, bh = b_cv.height;
    let cw = c_cv.width, ch = c_cv.height;
    
    b_ctx.clearRect(0, 0, bw, bh);
    c_ctx.clearRect(0, 0, cw, ch);

    aux_hit_regions = { boxes: [], bars: [] };

    // dynamic title names
    let label_b = 'Before'; let label_a = 'After';
    if (flow_dir === 'out') { 
        label_b = `Old ${target_cd}`; label_a = `Intersecting New CDs`;
    }
    else if (flow_dir === 'in') {
        label_b = `Intersecting Old CDs`; label_a = `New ${target_cd}`;
    }
    else {
        label_b = target_cd !== 'all' ? `Old ${target_cd}` : 'Old Map'; label_a = target_cd !== 'all' ? `New ${target_cd}` : 'New Map';
    }

    const fmt = (v) => {
        if (Math.abs(v) > 5 || metric === 'VAP') {
            return Math.round(v).toLocaleString(); 
        }
        
        let prefix = (metric === 'partisan_lean' && v > 0) ? '+' : '';
        return prefix + (v * 100).toFixed(1) + '%';
    };

    let all_display_nodes = [
        ...before_nodes.map(n => ({ id: n.id, val: n.true_metric, group: label_b })),
        ...after_nodes.map(n => ({ id: n.id, val: n.true_metric, group: label_a }))
    ];

    // custom chart for all_vap, the sandwich bar
    if (metric === 'all_vap') {
        c_ctx.fillStyle = '#aaa'; c_ctx.font = 'bold 12px sans-serif'; c_ctx.textAlign = 'center';
        c_ctx.fillText('District Composition', cw / 2, 15);

        let bar_h = Math.min(20, (ch - 40) / all_display_nodes.length - 4);
        let current_y = 30;
        let zero_x = 45; 
        let max_w = cw - zero_x - 10; 

        all_display_nodes.forEach((n, i) => {
            c_ctx.fillStyle = '#fff'; c_ctx.font = '11px sans-serif'; c_ctx.textAlign = 'left';
            c_ctx.fillText(`${n.id}`, 5, current_y + bar_h/2);

            let cx = zero_x;

            demographics.forEach(dem => {
                let sec_w = (n.val[dem.key] || 0) * max_w;
                if (sec_w > 0.5) {
                    c_ctx.fillStyle = dem.color.replace('0.7)', '1.0)');
                    c_ctx.fillRect(cx, current_y, sec_w, bar_h);

                    cx += sec_w;
                }
            });

            let rem_w = max_w - (cx - zero_x);
            if (rem_w > 0.5) {
                c_ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
                c_ctx.fillRect(cx, current_y, rem_w, bar_h);
            }
            
            current_y += bar_h + 4;
            if (i === before_nodes.length - 1) {
                current_y += 8; 
            }
        });

        // slope chart
        b_ctx.fillStyle = '#aaa'; b_ctx.font = 'bold 12px sans-serif'; b_ctx.textAlign = 'center';
        b_ctx.fillText('Mean Demographic Shift', bw / 2, 15);

        let b_means = {}, a_means = {};
        demographics.forEach(d => {
            b_means[d.key] = before_p_vals.reduce((s, v) => s + (v[d.key]||0), 0) / (before_p_vals.length||1);
            a_means[d.key] = after_p_vals.reduce((s, v) => s + (v[d.key]||0), 0) / (after_p_vals.length||1);
        });

        // make sure zero is never hit
        let m_max = Math.max(...Object.values(b_means), ...Object.values(a_means));
        if (m_max < 0.1) {
            m_max = 0.1; 
        }

        let y_map = (val) => bh - 25 - (val / m_max) * (bh - 55);
        let sx = 45, ex = bw - 45;

        demographics.forEach(d => {
            b_ctx.beginPath();
            b_ctx.moveTo(sx, y_map(b_means[d.key]));
            b_ctx.lineTo(ex, y_map(a_means[d.key]));
            b_ctx.lineWidth = 3;
            b_ctx.strokeStyle = d.color.replace('0.7)', '1.0)');
            b_ctx.stroke();

            b_ctx.fillStyle = b_ctx.strokeStyle;
            b_ctx.beginPath(); b_ctx.arc(sx, y_map(b_means[d.key]), 4, 0, Math.PI*2); b_ctx.fill();
            b_ctx.beginPath(); b_ctx.arc(ex, y_map(a_means[d.key]), 4, 0, Math.PI*2); b_ctx.fill();

            b_ctx.fillStyle = '#fff'; b_ctx.font = '10px sans-serif';
            b_ctx.textAlign = 'right'; b_ctx.textBaseline = 'middle';
            b_ctx.fillText((b_means[d.key]*100).toFixed(1)+'%', sx - 8, y_map(b_means[d.key]));
            b_ctx.textAlign = 'left'; 
            b_ctx.fillText((a_means[d.key]*100).toFixed(1)+'%', ex + 8, y_map(a_means[d.key]));
        });

        b_ctx.fillStyle = '#aaa'; b_ctx.font = '11px sans-serif'; b_ctx.textAlign = 'center';
        b_ctx.fillText('Before', sx, bh - 5);
        b_ctx.fillText('After', ex, bh - 5);

        return; 
    }

    // standard metric charts
    if (all_display_nodes.length > 0) {
        let bar_vals = all_display_nodes.map(n => n.val).filter(v => !isNaN(v));
        let bar_max = Math.max(...bar_vals);
        let bar_min = Math.min(...bar_vals); 
        
        if (bar_min > 0 && metric === 'partisan_lean') bar_min = 0;
        else if (bar_min > 0) bar_min = 0; 
        let bar_range = bar_max - bar_min || 1;

        c_ctx.fillStyle = '#aaa'; c_ctx.font = 'bold 12px sans-serif'; c_ctx.textAlign = 'center';
        c_ctx.fillText('District Comparison', cw / 2, 15);

        let bar_h = Math.min(20, (ch - 40) / all_display_nodes.length - 4);
        let current_y = 30;
        let zero_x = 75;
        let max_w = cw - zero_x - 50; 

        if (bar_min < 0) {
            zero_x = 75 + (-bar_min / bar_range) * max_w;
        }

        if (bar_min < 0 && bar_max > 0) {
            c_ctx.beginPath(); c_ctx.moveTo(zero_x, 20); c_ctx.lineTo(zero_x, ch - 5);
            c_ctx.strokeStyle = '#444'; c_ctx.stroke();
        }

        all_display_nodes.forEach((n, i) => {
            // Left Anchored Text prevents overlap
            c_ctx.fillStyle = '#fff'; c_ctx.font = '11px sans-serif'; c_ctx.textAlign = 'left'; c_ctx.textBaseline = 'middle';
            c_ctx.fillText(`CD ${n.id}`, 5, current_y + bar_h/2);

            let v = n.val;
            let w = (Math.abs(v) / bar_range) * max_w;
            let x = v < 0 ? zero_x - w : zero_x;
            
            // Unify Colors with the Alluvial
            if (metric === 'partisan_lean') {
                c_ctx.fillStyle = get_lean_color(v, 0.9);
            }
            else if (metric === 'turnout_rate') {
                c_ctx.fillStyle = get_turnout_shade(v, true);
            }
            else if (metric.startsWith('vap_')) {
                c_ctx.fillStyle = get_vap_shade(metric, v, true);
            }
            else if (metric === 'VAP') {
                c_ctx.fillStyle = n.group === label_b ? '#9b59b6' : '#8e44ad';
            }
            else {
                c_ctx.fillStyle = n.group === label_b ? 'rgba(150, 150, 150, 0.7)' : 'rgba(74, 144, 226, 0.9)';
            }
            
            c_ctx.fillRect(x, current_y, w, bar_h);

            c_ctx.fillStyle = '#ccc'; c_ctx.textAlign = v < 0 ? 'right' : 'left';

            let txt_x = v < 0 ? x - 5 : x + w + 5;
            c_ctx.fillText(fmt(v), txt_x, current_y + bar_h/2);

            aux_hit_regions.bars.push({ x, y: current_y, w, h: bar_h, val: v, label: `${n.group} ${n.id}` });
            
            current_y += bar_h + 4;
            if (i === before_nodes.length - 1) {
                current_y += 8; 
            }
        });
    }

    // draw density curves
    let before_vals = before_p_vals.filter(v => !isNaN(v)).sort((a, b) => a - b);
    let after_vals = after_p_vals.filter(v => !isNaN(v)).sort((a, b) => a - b);
    
    if (before_vals.length > 0 || after_vals.length > 0) {
        let box_max = Math.max(...before_vals, ...after_vals);
        let box_min = Math.min(...before_vals, ...after_vals); 

        let pad = (box_max - box_min) * 0.05;
        if (pad === 0) {
            pad = Math.abs(box_max * 0.1) || 1;
        }

        box_max += pad; box_min -= pad;
        let box_range = box_max - box_min || 1;

        b_ctx.fillStyle = '#aaa'; b_ctx.font = 'bold 12px sans-serif'; b_ctx.textAlign = 'center';
        b_ctx.fillText('Precinct Distribution Density', bw / 2, 15);

        let plot_start_x = 40;
        let plot_w = bw - 60;
        let x_map = (v) => plot_start_x + ((v - box_min) / box_range) * plot_w;

        const get_stats = (arr) => {
            const quantile = (q) => {
                const pos = (arr.length - 1) * q;
                const base = Math.floor(pos);
                if (arr[base + 1] !== undefined) {
                    return arr[base] + (pos - base) * (arr[base + 1] - arr[base]);
                }
                return arr[base];
            };
            return { min: arr[0], median: quantile(0.5) };
        };

        const draw_density = (vals, label, color) => {
            if (vals.length === 0) {
                return null;
            }
            
            const bins = 30;
            const counts = new Array(bins).fill(0);
            vals.forEach(v => {
                let i = Math.floor(((v - box_min) / box_range) * bins);
                if (i >= bins) i = bins - 1;
                if (i < 0) i = 0;
                counts[i]++;
            });
            
            const smoothed = [];
            for (let i = 0; i < bins; i++) {
                let prev = counts[i-1] || counts[i];
                let next = counts[i+1] || counts[i];
                smoothed.push((prev + counts[i]*2 + next) / 4);
            }

            let max_c = Math.max(...smoothed, 1);
            
            b_ctx.beginPath();
            b_ctx.moveTo(plot_start_x, bh - 20);
            smoothed.forEach((c, i) => {
                let x = plot_start_x + (i + 0.5) * (plot_w / bins);
                let y = (bh - 20) - (c / max_c) * (bh - 60);
                b_ctx.lineTo(x, y);
            });
            b_ctx.lineTo(plot_start_x + plot_w, bh - 20);
            
            b_ctx.fillStyle = color.replace('0.9)', '0.3)'); b_ctx.fill();
            b_ctx.strokeStyle = color; b_ctx.lineWidth = 2; b_ctx.stroke();

            let st = get_stats(vals);
            let med_x = x_map(st.median);

            b_ctx.beginPath(); b_ctx.setLineDash([4, 4]);
            b_ctx.moveTo(med_x, bh - 20); b_ctx.lineTo(med_x, 30);
            b_ctx.strokeStyle = color; b_ctx.stroke(); b_ctx.setLineDash([]);

            b_ctx.fillStyle = color; b_ctx.font = 'bold 11px sans-serif'; b_ctx.textAlign = 'left';
            b_ctx.fillText(label.substring(0, 8), med_x + 5, label === label_b ? 40 : 55);

            // return curve for display points
            return { smoothed, max_c };
        };

        let curve_b = null; let curve_a = null;
        if (before_vals.length > 0) {
            curve_b = draw_density(before_vals, label_b, 'rgba(150, 150, 150, 0.9)');
        }
        if (after_vals.length > 0) {
            curve_a = draw_density(after_vals, label_a, 'rgba(74, 144, 226, 0.9)');
        }

        // color x axis line using our axis coloration
        let axis_grad = b_ctx.createLinearGradient(plot_start_x, 0, plot_start_x + plot_w, 0);
        for (let i = 0; i <= 1; i += 0.1) {
            let v = box_min + (i * box_range);
            let c = '#ccc';
            
            if (metric === 'partisan_lean') {
                c = get_lean_color(v, 1.0);
            }
            else if (metric === 'turnout_rate') {
                c = get_turnout_shade(v, true);
            }
            else if (metric.startsWith('vap_')) {
                c = get_vap_shade(metric, v, true);
            }
            else if (metric === 'VAP') {
                let p = v / (map_layer === 'Precinct.' ? 4000 : 800000);
                c = `hsl(280, 65%, ${95 - Math.min(1, p) * 60}%)`;
            }

            axis_grad.addColorStop(i, c);
        }
        
        b_ctx.beginPath();
        b_ctx.moveTo(plot_start_x, bh - 20);
        b_ctx.lineTo(plot_start_x + plot_w, bh - 20);
        b_ctx.strokeStyle = axis_grad; 
        b_ctx.lineWidth = 4;
        b_ctx.stroke();
        b_ctx.lineWidth = 1; 
        
        // draw axis text
        b_ctx.fillStyle = '#888'; b_ctx.font = '10px sans-serif'; b_ctx.textBaseline = 'top';
        b_ctx.textAlign = 'left'; b_ctx.fillText(fmt(box_min), plot_start_x, bh - 15);
        b_ctx.textAlign = 'center'; b_ctx.fillText(fmt((box_min + box_max) / 2), plot_start_x + plot_w / 2, bh - 15);
        b_ctx.textAlign = 'right'; b_ctx.fillText(fmt(box_max), plot_start_x + plot_w, bh - 15);

        // big hitbox create
        aux_hit_regions.boxes.push({ type: 'density', x: plot_start_x, y: 0, w: plot_w, h: bh, box_min, box_range, curve_b, curve_a });
    }

    // the dots riding on the curve
    if (aux_hover.boxes && aux_hover.boxes.type === 'density' && window.aux_hover_pos && window.aux_hover_pos.boxes) {
        let hb = aux_hover.boxes;
        let m_x = window.aux_hover_pos.boxes.x;
        
        if (m_x >= hb.x && m_x <= hb.x + hb.w) {
            let val = hb.box_min + ((m_x - hb.x) / hb.w) * hb.box_range;
            
            // crosshair
            b_ctx.beginPath();
            b_ctx.moveTo(m_x, 30);
            b_ctx.lineTo(m_x, bh - 20);
            b_ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            b_ctx.lineWidth = 1.5;
            b_ctx.setLineDash([4, 4]);
            b_ctx.stroke();
            b_ctx.setLineDash([]);
            b_ctx.lineWidth = 1;
            
            // y value calc
            const bins = 30; 
            let bin_idx = ((m_x - hb.x) / hb.w) * bins;
            let i0 = Math.floor(bin_idx);
            let i1 = Math.min(bins - 1, i0 + 1);
            let t = bin_idx - i0; 
            
            let b_y = null, a_y = null;
            let b_val = null, a_val = null;
            
            if (hb.curve_b) {
                let c = hb.curve_b.smoothed[i0] * (1 - t) + hb.curve_b.smoothed[i1] * t;
                b_y = (bh - 20) - (c / hb.curve_b.max_c) * (bh - 60);
                b_val = c;
                b_ctx.beginPath(); b_ctx.arc(m_x, b_y, 4, 0, Math.PI*2); 
                b_ctx.fillStyle = '#aaa'; b_ctx.fill(); b_ctx.strokeStyle='#fff'; b_ctx.stroke();
            }

            if (hb.curve_a) {
                let c = hb.curve_a.smoothed[i0] * (1 - t) + hb.curve_a.smoothed[i1] * t;
                a_y = (bh - 20) - (c / hb.curve_a.max_c) * (bh - 60);
                a_val = c;
                b_ctx.beginPath(); b_ctx.arc(m_x, a_y, 4, 0, Math.PI*2); 
                b_ctx.fillStyle = '#4a90e2'; b_ctx.fill(); b_ctx.strokeStyle='#fff'; b_ctx.stroke();
            }
            
            // draw tooltip
            let tx = m_x + 10;
            let min_y = Math.min(b_y || Infinity, a_y || Infinity);
            let ty = min_y === Infinity ? bh / 2 : min_y - 20;
            
            let box_h = 25 + (b_val !== null ? 15 : 0) + (a_val !== null ? 15 : 0);
            if (tx + 120 > bw) tx = m_x - 130;
            if (ty + box_h > bh) ty = bh - box_h;
            
            b_ctx.fillStyle = 'rgba(0,0,0,0.85)';
            b_ctx.fillRect(tx, ty, 120, box_h);
            b_ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            b_ctx.strokeRect(tx, ty, 120, box_h);
            
            b_ctx.fillStyle = '#fff'; b_ctx.font = 'bold 11px sans-serif'; b_ctx.textAlign = 'left'; b_ctx.textBaseline='top';
            b_ctx.fillText(`${fmt(val)}`, tx + 5, ty + 5);
            
            let current_ty = ty + 22;
            b_ctx.font = '10px sans-serif';
            if (b_val !== null) {
                b_ctx.fillStyle = '#aaa'; b_ctx.fillText(`Before Density: ${b_val.toFixed(1)}`, tx + 5, current_ty);
                current_ty += 15;
            }

            if (a_val !== null) {
                b_ctx.fillStyle = '#4a90e2'; b_ctx.fillText(`After Density: ${a_val.toFixed(1)}`, tx + 5, current_ty);
            }

            render_scale({ type: 'density', val: val });
        }
    }
};

let alluvial_hit_regions = { nodes: [], links: [] };

const render_alluvial = () => {
    const ctx = alluv_cv.getContext('2d');
    ctx.clearRect(0, 0, alluv_cv.width, alluv_cv.height);

    // reset hit regions
    alluvial_hit_regions = { nodes: [], links: [] };

    const metric = current_metric;
    //const target_cd = '05';
    //const flow_dir = 'out'; // can be in | out | both
    
    // column ordering
    const co = 'normal';
    const bcol = co === 'normal' ? 'CD116FP' : 'CD118FP';
    const acol = co === 'normal' ? 'CD118FP' : 'CD116FP';
    const lcol = co === 'normal' ? 'Before (CD116FP)' : 'After (CD118FP)';
    const rcol = co === 'normal' ? 'After (CD118FP)' : 'Before (CD116FP)';

    // filter data based on flow direction
    let plot_data = data[ts];
    if (target_cd !== 'all') {
        plot_data = data[ts].filter(row => {
            if (flow_dir === 'out') {
                return row[bcol] === target_cd;
            }

            if (flow_dir === 'in') {
                return row[acol] === target_cd;
            }

            return (row[bcol] === target_cd || row[acol] === target_cd);
        });
    }

    if (plot_data.length === 0) {
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#999';
        ctx.fillText('No flow data for this selection.', alluv_cv.width / 2, alluv_cv.height / 2);
        return;
    }

    // scale padding (futureproof for larger canvas sizes)
    let padding = Math.max(30, alluv_cv.height * 0.1); 
    let node_width = Math.max(15, alluv_cv.width * 0.05);
    let node_gap = Math.max(10, alluv_cv.height * 0.05); 

    let margin_h = Math.min(200, alluv_cv.width * 0.15); 

    let lx = margin_h; 
    let rx = alluv_cv.width - node_width - margin_h; 
    let draw_height = alluv_cv.height - (padding * 2);

    let left_nodes_d = {};
    let right_nodes_d = {};

    // these maintain appearance order
    let left_nodes = [];
    let right_nodes = [];
    
    let link_groups = {}; 

    let total_flow = 0;

    plot_data.forEach(row => {
        let { flow_size, metric_val } = extract_metric(row, metric);
        if (flow_size <= 0) return; 
        total_flow += flow_size;

        if (!left_nodes_d[row[bcol]]) {
            left_nodes_d[row[bcol]] = { id: row[bcol], value: 0 };
            left_nodes.push(left_nodes_d[row[bcol]]);
        }
        left_nodes_d[row[bcol]].value += flow_size;

        if (!right_nodes_d[row[acol]]) {
            right_nodes_d[row[acol]] = { id: row[acol], value: 0 };
            right_nodes.push(right_nodes_d[row[acol]]);
        }
        right_nodes_d[row[acol]].value += flow_size;

        let linkKey = `${row[bcol]}|${row[acol]}`;
        if (!link_groups[linkKey]) {
            link_groups[linkKey] = { 
                source: row[bcol], target: row[acol], value: 0, link_total_vap: 0,
                weighted_sum: (metric === 'all_vap') ? { vap_black: 0, vap_aian: 0, vap_asian: 0, vap_nhpi: 0 } : 0 
            };
        }

        link_groups[linkKey].value += flow_size;
        link_groups[linkKey].link_total_vap += (row['VAP'] || 0);
        
        if (metric === 'all_vap') {
            for (let k in metric_val) {
                link_groups[linkKey].weighted_sum[k] += (metric_val[k] * flow_size);
            }
        }
        
        else {
            link_groups[linkKey].weighted_sum += (metric_val * flow_size);
        }
    });

    // find true district statistics
    let true_stats = { left: {}, right: {} };
    Object.keys(left_nodes_d).forEach(id => true_stats.left[id] = { weight: 0, sum: (metric === 'all_vap') ? {} : 0, vap: 0 });
    Object.keys(right_nodes_d).forEach(id => true_stats.right[id] = { weight: 0, sum: (metric === 'all_vap') ? {} : 0, vap: 0 });

    data[ts].forEach(row => {
        let b_id = row[bcol];
        let a_id = row[acol];
        
        // skip nonexistent cd rows
        if (!true_stats.left[b_id] && !true_stats.right[a_id]) return; 
        
        let { flow_size, metric_val, total_vap } = extract_metric(row, metric);
        if (flow_size <= 0) return;

        if (true_stats.left[b_id]) {
            true_stats.left[b_id].weight += flow_size;
            true_stats.left[b_id].vap += total_vap;
            if (metric === 'all_vap') {
                for (let k in metric_val) {
                    true_stats.left[b_id].sum[k] = (true_stats.left[b_id].sum[k] || 0) + (metric_val[k] * flow_size);
                }
            } 
            else {
                true_stats.left[b_id].sum += (metric_val * flow_size);
            }
        }
        if (true_stats.right[a_id]) {
            true_stats.right[a_id].weight += flow_size;
            true_stats.right[a_id].vap += total_vap;
            if (metric === 'all_vap') {
                for (let k in metric_val) {
                    true_stats.right[a_id].sum[k] = (true_stats.right[a_id].sum[k] || 0) + (metric_val[k] * flow_size);
                }
            } 
            else {
                true_stats.right[a_id].sum += (metric_val * flow_size);
            }
        }
    });

    // get true metrics!!
    left_nodes.forEach(n => {
        let ts_obj = true_stats.left[n.id];
        n.true_total_vap = ts_obj.vap;
        if (metric === 'all_vap') {
            n.true_metric = {};
            for (let k in ts_obj.sum) {
                n.true_metric[k] = ts_obj.weight > 0 ? ts_obj.sum[k] / ts_obj.weight : 0;
            }
        } 
        else if (metric.startsWith('vap_')) {
            n.true_metric = ts_obj.vap > 0 ? ts_obj.weight / ts_obj.vap : 0;
        } 
        else if (metric === 'VAP') {
            n.true_metric = ts_obj.vap; 
        }
        else {
            n.true_metric = ts_obj.weight > 0 ? ts_obj.sum / ts_obj.weight : 0;
        }
    });

    right_nodes.forEach(n => {
        let ts_obj = true_stats.right[n.id];
        n.true_total_vap = ts_obj.vap; 
        if (metric === 'all_vap') {
            n.true_metric = {};
            for (let k in ts_obj.sum) {
                n.true_metric[k] = ts_obj.weight > 0 ? ts_obj.sum[k] / ts_obj.weight : 0;
            }
        } 
        else if (metric.startsWith('vap_')) {
            n.true_metric = ts_obj.vap > 0 ? ts_obj.weight / ts_obj.vap : 0;
        } 
        else if (metric === 'VAP') {
            n.true_metric = ts_obj.vap; 
        } 
        else {
            n.true_metric = ts_obj.weight > 0 ? ts_obj.sum / ts_obj.weight : 0;
        }
    });

    let links = Object.values(link_groups);
    links.forEach(l => {
        if (metric === 'all_vap') {
            l.true_metric = {};
            for (let k in l.weighted_sum) l.true_metric[k] = l.value > 0 ? l.weighted_sum[k] / l.value : 0;
        } else if (metric.startsWith('vap_')) {
            l.true_metric = l.link_total_vap > 0 ? l.value / l.link_total_vap : 0;
        } else if (metric === 'VAP') {
            l.true_metric = l.value; 
        } else {
            l.true_metric = l.value > 0 ? l.weighted_sum / l.value : 0;
        }
    });


    // calculate scale
    let free_left = draw_height - Math.max(0, left_nodes.length - 1) * node_gap;
    let free_right = draw_height - Math.max(0, right_nodes.length - 1) * node_gap;
    let scale_left = free_left / total_flow;
    let scale_right = free_right / total_flow;
    let scale = Math.min(scale_left, scale_right);

    // calculate total pixel height of columns
    let total_left = left_nodes.reduce((sum, n) => sum + (n.value * scale), 0) + Math.max(0, left_nodes.length - 1) * node_gap;
    let total_right = right_nodes.reduce((sum, n) => sum + (n.value * scale), 0) + Math.max(0, right_nodes.length - 1) * node_gap;

    // vertically center
    let start_left = (alluv_cv.height - total_left) / 2;
    let start_right = (alluv_cv.height - total_right) / 2;

    const get_base_y = (nodes, start) => {
        let cy = start;
        nodes.forEach(node => {
            node.y = cy;
            node.height = node.value * scale;
            cy += node.height + node_gap;
        });
    }

    get_base_y(left_nodes, start_left);
    get_base_y(right_nodes, start_right);

    // apply x coords
    left_nodes.forEach(n => n.x = lx);
    right_nodes.forEach(n => n.x = rx);

    //let links = Object.values(link_groups);
    //calculate_true_metrics(links);

    // unspaghetti the left
    left_nodes.forEach(node => {
        let outgoing = links.filter(l => l.source === node.id);
        outgoing.sort((a, b) => right_nodes_d[a.target].y - right_nodes_d[b.target].y);
        
        let cy = node.y;
        outgoing.forEach(l => {
            l.start = cy;
            cy += l.value * scale;
        });
    });

    // unspaghetti the right
    right_nodes.forEach(node => {
        let incoming = links.filter(l => l.target === node.id);
        incoming.sort((a, b) => left_nodes_d[a.source].y - left_nodes_d[b.source].y);
        
        let cy = node.y;
        incoming.forEach(l => {
            l.ey = cy;
            cy += l.value * scale;
        });
    });

    // draw the links
    links.forEach(link => {
        let sx = lx + node_width;
        let ex = rx;
        let cp1x = sx + (ex - sx) / 2;
        let cp2x = sx + (ex - sx) / 2;
        let line_width = link.value * scale;
        let link_id = `${link.source}|${link.target}`; 
        let is_hovered = (current_hover && current_hover.type === 'link' && current_hover.id === link_id);

        // build path for highlighting
        let path = new Path2D();
        path.moveTo(sx, link.start);
        path.bezierCurveTo(cp1x, link.start, cp2x, link.ey, ex, link.ey);
        path.lineTo(ex, link.ey + line_width);
        path.bezierCurveTo(cp2x, link.ey + line_width, cp1x, link.start + line_width, sx, link.start + line_width);
        path.closePath();

        // calculate dynamic retention
        let s_retention = left_nodes_d[link.source].true_total_vap > 0 ? link.value / left_nodes_d[link.source].true_total_vap : 0;
        let t_retention = right_nodes_d[link.target].true_total_vap > 0 ? link.value / right_nodes_d[link.target].true_total_vap : 0;

        alluvial_hit_regions.links.push({
            id: link_id,
            path: path,
            source_val: metric === 'VAP' ? s_retention : left_nodes_d[link.source].true_metric,
            target_val: metric === 'VAP' ? t_retention : right_nodes_d[link.target].true_metric,
            flow_val: link.true_metric
        });

        // stack ribbons if we are in the all_vap mode
        if (metric === 'all_vap' && typeof link.true_metric === 'object') {
            let current_start = link.start;
            let current_ey = link.ey;
            let accounted_width = 0;
            let total_width = link.value * scale;

            demographics.forEach(dem => {
                let band_width = (link.true_metric[dem.key] || 0) * total_width;
                
                if (band_width > 0.5) {
                    ctx.beginPath();
                    ctx.moveTo(sx, current_start);
                    ctx.bezierCurveTo(cp1x, current_start, cp2x, current_ey, ex, current_ey);
                    ctx.lineTo(ex, current_ey + band_width);
                    ctx.bezierCurveTo(cp2x, current_ey + band_width, cp1x, current_start + band_width, sx, current_start + band_width);
                    ctx.closePath();

                    ctx.fillStyle = dem.color;
                    ctx.fill(); 
                }

                current_start += band_width;
                current_ey += band_width;
                accounted_width += band_width;
            });

            let remainder_width = total_width - accounted_width;
            if (remainder_width > 0.5) {
                ctx.beginPath();
                ctx.moveTo(sx, current_start);
                ctx.bezierCurveTo(cp1x, current_start, cp2x, current_ey, ex, current_ey);
                ctx.lineTo(ex, current_ey + remainder_width);
                ctx.bezierCurveTo(cp2x, current_ey + remainder_width, cp1x, current_start + remainder_width, sx, current_start + remainder_width);
                ctx.closePath();

                ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
                ctx.fill();
            }

            if (is_hovered) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'white';
                ctx.stroke(path);
            }
        } 
        
        else {
            let start = link.start;
            let ey = link.ey;
            let line_width = link.value * scale;

            let path = new Path2D();
            path.moveTo(sx, start);
            path.bezierCurveTo(cp1x, start, cp2x, ey, ex, ey);
            path.lineTo(ex, ey + line_width);
            path.bezierCurveTo(cp2x, ey + line_width, cp1x, start + line_width, sx, start + line_width);
            path.closePath();

            alluvial_hit_regions.links.push({
                path: path,
                source_val: left_nodes_d[link.source].true_metric,
                target_val: right_nodes_d[link.target].true_metric
            });

            let source_focused = (link.source === target_cd || target_cd === 'all');
            let target_focused = (link.target === target_cd || target_cd === 'all');

            if (metric.startsWith('vap_')) {
                let source_percent = left_nodes_d[link.source].true_metric;
                let target_percent = right_nodes_d[link.target].true_metric;
                
                let gradient = ctx.createLinearGradient(sx, 0, ex, 0);
                gradient.addColorStop(0, get_vap_shade(metric, source_percent, source_focused));
                gradient.addColorStop(1, get_vap_shade(metric, target_percent, target_focused));
                
                ctx.fillStyle = gradient;
                ctx.fill(path); 
                
            } 
            else if (metric === 'turnout_rate') {
                let source_percent = left_nodes_d[link.source].true_metric;
                let target_percent = right_nodes_d[link.target].true_metric;
                
                let gradient = ctx.createLinearGradient(sx, 0, ex, 0);
                gradient.addColorStop(0, get_turnout_shade(source_percent, source_focused));
                gradient.addColorStop(1, get_turnout_shade(target_percent, target_focused));
                
                ctx.fillStyle = gradient;
                ctx.fill(path);
                
            } 
            else if (metric === 'partisan_lean') {
                let source_lean = left_nodes_d[link.source].true_metric;
                let target_lean = right_nodes_d[link.target].true_metric;
                
                let gradient = ctx.createLinearGradient(sx, 0, ex, 0);
                
                gradient.addColorStop(0, get_lean_color(source_lean, source_focused ? 0.9 : 0.2));
                gradient.addColorStop(1, get_lean_color(target_lean, target_focused ? 0.9 : 0.2));
                
                ctx.fillStyle = gradient;
                ctx.fill(path);
                
            }
            else if (metric === 'VAP') {
                    let source_total = left_nodes_d[link.source].true_total_vap; 
                    ctx.fillStyle = get_retention_shade(link.value, source_total, source_focused);
                    ctx.fill(path);
            }
            else {
                ctx.fillStyle = 'rgba(74, 144, 226, 0.4)';
                ctx.strokeStyle = 'rgba(74, 144, 226, 0.7)';
                ctx.fill(path);
                ctx.stroke(path);
            }if (is_hovered) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'white';
                ctx.stroke(path);
            }
        }
    });

    ctx.textBaseline = 'middle';

    // draw nodes and labels
    const render_column_arr = (nodes, align, showFlows) => {
        nodes.forEach(node => {
            let focused = node.id === target_cd;

            // the box colors
            let is_focused = (focused || target_cd === 'all');

            if (metric === 'all_vap') {
                let current_y = node.y;
                let accounted_height = 0;

                demographics.forEach(dem => {
                    let section_height = (node.true_metric[dem.key] || 0) * node.height;
                    
                    if (section_height > 0.5) {
                        ctx.fillStyle = is_focused ? dem.color : dem.color.replace('0.7)', '0.2)');
                        ctx.fillRect(node.x, current_y, node_width, section_height);
                        current_y += section_height;
                        accounted_height += section_height;
                    }
                });

                let remainder_height = node.height - accounted_height;
                if (remainder_height > 0.5) {
                    ctx.fillStyle = is_focused ? 'rgba(200, 200, 200, 0.6)' : 'rgba(200, 200, 200, 0.2)';
                    ctx.fillRect(node.x, current_y, node_width, remainder_height);
                }

            } 
            else if (metric === 'partisan_lean') {
                ctx.fillStyle = get_lean_color(node.true_metric, is_focused ? 1.0 : 0.4);
                ctx.fillRect(node.x, node.y, node_width, node.height);
                
            }
            else if (metric === 'turnout_rate') {
                ctx.fillStyle = get_turnout_shade(node.true_metric, is_focused);
                ctx.fillRect(node.x, node.y, node_width, node.height);
            }
            else if (metric.startsWith('vap_')) {
                ctx.fillStyle = get_vap_shade(metric, node.true_metric, is_focused);
                ctx.fillRect(node.x, node.y, node_width, node.height);
                
            }
            else if (metric === 'VAP') {
                let max_link = 0;
                if (align === 'left') {
                    let out = links.filter(l => l.source === node.id);
                    if (out.length > 0) {
                        max_link = Math.max(...out.map(l => l.value));
                    }
                } 
                else {
                    let inc = links.filter(l => l.target === node.id);
                    if (inc.length > 0) {
                        max_link = Math.max(...inc.map(l => l.value));
                    }
                }
                
                node.retention_pct = node.true_total_vap > 0 ? max_link / node.true_total_vap : 0;
                ctx.fillStyle = get_retention_shade(node.retention_pct, 1.0, is_focused);
                ctx.fillRect(node.x, node.y, node_width, node.height);
            }
            else {
                if (target_cd === 'all') {
                    ctx.fillStyle = align === 'left' ? '#4a90e2' : '#50e3c2'; 
                } 
                else {
                    ctx.fillStyle = align === 'left' ? 
                        (focused ? '#4a90e2' : '#2b527d') : 
                        (focused ? '#50e3c2' : '#287362');
                }
                ctx.fillRect(node.x, node.y, node_width, node.height);
            }

            let unique_id = `${align}_${node.id}`;

            // add hit region to list
            alluvial_hit_regions.nodes.push({
                id: unique_id, 
                x: node.x, y: node.y, w: node_width, h: node.height,
                val: metric === 'VAP' ? node.retention_pct : node.true_metric
            });

            // node highlight 
            if (typeof current_hover !== 'undefined' && current_hover && current_hover.type === 'node' && current_hover.id === unique_id) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'white';
                ctx.strokeRect(node.x, node.y, node_width, node.height);
            }

            // the text
            ctx.fillStyle = focused || target_cd === 'all' ? '#ddd' : '#666';
            ctx.font = focused ? 'bold 14px sans-serif' : '14px sans-serif';
            
            let textY = node.y + (node.height / 2);
            let label = node.id;

            if (align === 'left') {
                ctx.textAlign = 'right';
                ctx.fillText(label, node.x - 10, textY);
            } 
            else {
                ctx.textAlign = 'left';
                ctx.fillText(label, node.x + node_width + 10, textY);
            }
        });
    }

    let show_left = (flow_dir === 'both' || flow_dir === 'out');
    let show_right = (flow_dir === 'both' || flow_dir === 'in');

    render_column_arr(left_nodes, 'left', show_left);
    render_column_arr(right_nodes, 'right', show_right);
    
    // headers
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#aaa';

    // render our scale
    render_scale(typeof current_hover !== 'undefined' ? current_hover : null);

    // this is jank but it works i swear
    //render_aux_charts(left_nodes, right_nodes, metric);

    // get precinct level data for boxplots
    let before_precinct_vals = [];
    let after_precinct_vals = [];
    
    data[ts].forEach(row => {
        let { metric_val } = extract_metric(row, metric);
        
        if (target_cd === 'all') {
            before_precinct_vals.push(metric_val);
            after_precinct_vals.push(metric_val);
        } else {
            if (row[bcol] === target_cd) {
                before_precinct_vals.push(metric_val);
            }
            if (row[acol] === target_cd) {
                after_precinct_vals.push(metric_val);
            }
        }
    });

    render_aux_charts(left_nodes, right_nodes, before_precinct_vals, after_precinct_vals, metric, target_cd, flow_dir);
}



// .---------------------------.
// |         PAGE LOAD         |
// '---------------------------'

const load = () => {

    // init our lookup tables
    init_lookup_tables();

    // read map data
    init_map();

    // init event listeners
    init_events();


    // try to draw the map 
    draw_map();
    request_buffer_update();
}


// .---------------------------------.
// |         CANVAS CONTROLS         |
// '---------------------------------'

let main_ctx = undefined;
let z_sense = 0.001;

let scale = 1.0
let offset_x = 0;
let offset_y = 0;

let is_dragging = false;
let last_mouse_x = 0;
let last_mouse_y = 0;

let shift_x = 0;
let shift_y = 0;

let update_pending = false;

let current_hover = null;

let init_events = () => {
    
    // flow direction controls
    document.querySelectorAll('.flow_btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            
            document.querySelectorAll('.flow_btn').forEach(b => {
                b.classList.remove('bselect');
                b.style.color = '#aaa';
            });
            btn.classList.add('bselect');
            btn.style.color = '#fff';
            
            flow_dir = btn.getAttribute('data-flow');
            request_buffer_update();
        });
    });

    document.querySelector(`.metric[value="${current_metric}"]`)?.classList.add('aselect');
    document.getElementById('metric_desc').innerHTML = metric_descriptions[current_metric];

    document.querySelectorAll('.metric').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.metric').forEach(m => m.classList.remove('aselect'));
            el.classList.add('aselect');
            
            current_metric = el.getAttribute('value');
            
            document.getElementById('metric_desc').innerHTML = metric_descriptions[current_metric] || '';
            request_buffer_update();
        });
    });

    document.getElementById('select_fl').classList.add('aselect');
    document.getElementById('select_va').classList.remove('aselect');
    
    document.querySelectorAll('.selector').forEach(sel => {
        sel.addEventListener('click', () => {
            document.querySelectorAll('.selector').forEach(s => s.classList.remove('aselect'));
            sel.classList.add('aselect');
            
            ts = sel.id === 'select_fl' ? 'fl' : 'va';
            target_cd = 'all'; 
            
            load_state_data();
            request_buffer_update();
        });
    });

    document.querySelectorAll('.ablock').forEach(block => {
        const title = block.querySelector('.atitle')?.innerText;
        const options = block.querySelectorAll('.aoption');
        
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('aselect'));
                opt.classList.add('aselect');
                
                if (title === 'Display Layer') map_layer = opt.innerText;
                if (title === 'Geometries') map_geoms = opt.innerText;
                if (title === 'Timeline') {
                    map_timeline = opt.innerText;
                    //flow_dir = map_timeline === '2020' ? 'out' : 'in'; 
                    target_cd = 'all';
                }
                request_buffer_update();
            });
        });
    });

    let click_start_x = 0; let click_start_y = 0;

    main_cv.addEventListener('mousedown', (e) => {
        is_dragging = true;
        last_mouse_x = e.clientX;
        last_mouse_y = e.clientY;
        click_start_x = e.clientX;
        click_start_y = e.clientY;
        main_cv.style.cursor = 'pointer';

        // hide tooltip
        if (map_hover) {
            map_hover = null;
            render_main();
            render_scale(current_hover); 
        }
    });

    main_cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        let z_factor = Math.exp(-e.deltaY * z_sense); 
        
        const rect = main_cv.getBoundingClientRect();
        const m_x = e.clientX - rect.left;
        const m_y = e.clientY - rect.top;
        
        const w_x = offset_x + (m_x - shift_x) / scale;
        const w_y = offset_y + (m_y - shift_y) / scale;
        
        scale *= z_factor;
        scale = Math.max(0.05, Math.min(scale, 50));
        
        offset_x = w_x - m_x / scale;
        offset_y = w_y - m_y / scale;
        
        shift_x = 0;
        shift_y = 0;
        
        request_buffer_update();
    }, {passive: false});

    addEventListener('mousemove', (e) => {
        if (is_dragging) {
            const dx = e.clientX - last_mouse_x;
            const dy = e.clientY - last_mouse_y;
            last_mouse_x = e.clientX;
            last_mouse_y = e.clientY;
            
            shift_x += dx;
            shift_y += dy;
            offset_x -= dx / scale;
            offset_y -= dy / scale;
            
            render_main();
            request_buffer_update();
        } 
        else {
            if (scale > 2 && map_layer === 'Precinct.') {
                const rect = main_cv.getBoundingClientRect();
                const m_x = e.clientX - rect.left;
                const m_y = e.clientY - rect.top;
                
                const w_x = offset_x + (m_x - shift_x) / scale;
                const w_y = offset_y + (m_y - shift_y) / scale;
                
                let found = null;
                const ctx = buffer.getContext('2d');
                
                let min_dist = (20 / scale) * (20 / scale); 
                
                // fuzzy lookup logic
                for (let i = 0; i < data[ts].length; i++) {
                    let row = data[ts][i];
                    let geom = get_geom(row, 'PCT_STD');
                    if(!geom) {
                        continue;
                    }
                    let r = geom.radius, c = geom.cpoint;
                    
                    if (Math.abs(c.x - w_x) <= r && Math.abs(c.y - w_y) <= r) {
                        if (ctx.isPointInPath(geom.lods.high, w_x, w_y)) {
                            found = row;
                            break; 
                        }
                    }

                    let dx = c.x - w_x;
                    let dy = c.y - w_y;
                    let sq_dist = dx*dx + dy*dy;
                    
                    if (sq_dist < min_dist) {
                        min_dist = sq_dist;
                        found = row;
                    }
                }

                if (map_hover !== found || (found && (map_hover_pos.x !== m_x || map_hover_pos.y !== m_y))) {
                    map_hover = found;
                    map_hover_pos = { x: m_x, y: m_y };
                    render_main(); 
                    render_scale(current_hover);
                }
            } 
            else if (map_hover) {
                map_hover = null;
                render_main();
                render_scale(current_hover);
            }
        }
    });

    addEventListener('mouseup', (e) => {
        if (is_dragging) {
            is_dragging = false;
            main_cv.style.cursor = 'default';
            
            // check the size of the moust movement upon release
            const dist = Math.hypot(e.clientX - click_start_x, e.clientY - click_start_y);
            if (dist < 5) {
                const rect = main_cv.getBoundingClientRect();
                const m_x = e.clientX - rect.left;
                const m_y = e.clientY - rect.top;
                
                const w_x = offset_x + (m_x - shift_x) / scale;
                const w_y = offset_y + (m_y - shift_y) / scale;

                const cycle_col = map_timeline === '2020' ? 'CD116FP' : 'CD118FP';
                const overlay_geoms = geom_groups[cycle_col];
                const ctx = buffer.getContext('2d');
                
                let clicked_cd = 'all';
                
                // find what cd poly we fell into
                for (let cd in overlay_geoms) {
                    if (ctx.isPointInPath(overlay_geoms[cd].lods.high, w_x, w_y)) {
                        clicked_cd = cd;
                        break;
                    }
                }
                
                // update and redraw
                target_cd = target_cd === clicked_cd ? 'all' : clicked_cd;
                
                request_buffer_update();
            } 
            else {
                request_buffer_update();
            }
        }
    });

    addEventListener('resize', (e) => {
        const old_width = main_cv.width;
        const old_height = main_cv.height;

        const old_cx = old_width / 2;
        const old_cy = old_height / 2;

        const world_cx = old_width === 0 ? 0 : offset_x + old_cx / scale;
        const world_cy = old_height === 0 ? 0 : offset_y + old_cy / scale;

        const new_width = window.innerWidth;
        const new_height = window.innerHeight;
        
        main_cv.width = new_width;
        main_cv.height = new_height;
        buffer.width = new_width;
        buffer.height = new_height;

        const new_cx = new_width / 2;
        const new_cy = new_height / 2;

        offset_x = world_cx - new_cx / scale;
        offset_y = world_cy - new_cy / scale;

        shift_x = 0;
        shift_y = 0;

        request_buffer_update();
    });

    alluv_cv.addEventListener('mousemove', (e) => {
        const rect = alluv_cv.getBoundingClientRect();
        const scaleX = alluv_cv.width / rect.width;
        const scaleY = alluv_cv.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        let new_hover = null;
        
        for (let n of alluvial_hit_regions.nodes) {
            if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
                new_hover = { type: 'node', id: n.id, val: n.val };
                break;
            }
        }
        
        if (!new_hover) {
            const ctx = alluv_cv.getContext('2d');
            for (let l of alluvial_hit_regions.links) {
                if (ctx.isPointInPath(l.path, x, y)) {
                    new_hover = { type: 'link', id: l.id, source_val: l.source_val, target_val: l.target_val, flow_val: l.flow_val };
                    break;
                }
            }
        }
        
        if (JSON.stringify(new_hover) !== JSON.stringify(current_hover)) {
            current_hover = new_hover;
            render_alluvial(); 
        }
    });

    alluv_cv.addEventListener('mouseout', () => {
        current_hover = null;
        render_alluvial();
    });

    const attach_hover = (cv_id, type) => {
        const cv = document.getElementById(cv_id);

        cv.addEventListener('mousemove', (e) => {
            const rect = cv.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (cv.width / rect.width);
            const y = (e.clientY - rect.top) * (cv.height / rect.height);

            window.aux_hover_pos = window.aux_hover_pos || { boxes: {x:0, y:0}, bars: {x:0, y:0} };
            window.aux_hover_pos[type] = { x, y };

            let hovered = null;
            for (let r of aux_hit_regions[type]) {
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { 
                    hovered = r; break; 
                }
            }

            if (aux_hover[type] !== hovered || (type === 'boxes' && hovered)) {
                aux_hover[type] = hovered;
                render_aux_charts(aux_chart_state.before, aux_chart_state.after, aux_chart_state.before_p, aux_chart_state.after_p, aux_chart_state.metric, aux_chart_state.target_cd, aux_chart_state.flow_dir);
            }
        });

        cv.addEventListener('mouseout', () => {
            aux_hover[type] = null;
            render_aux_charts(aux_chart_state.before, aux_chart_state.after, aux_chart_state.before_p, aux_chart_state.after_p, aux_chart_state.metric, aux_chart_state.target_cd, aux_chart_state.flow_dir);
            
            if (type === 'boxes') {
                render_scale(current_hover); 
            }
        });
    };

    attach_hover('boxes_cv', 'boxes');
    attach_hover('bars_cv', 'bars');

    alluv_cv.addEventListener('click', (e) => {
        const rect = alluv_cv.getBoundingClientRect();
        const scaleX = alluv_cv.width / rect.width;
        const scaleY = alluv_cv.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const ctx = alluv_cv.getContext('2d');
        let clicked_something = false;

        for (let n of alluvial_hit_regions.nodes) {
            if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
                let parts = n.id.split('_'); 
                let align = parts[0]; 
                
                target_cd = parts[1]; 
                
                if (align === 'left') {
                    map_timeline = '2020'; flow_dir = 'out';
                } 
                else {
                    map_timeline = '2023'; flow_dir = 'in';
                }

                clicked_something = true;
                break;
            }
        }
        
        if (!clicked_something) {
            for (let l of alluvial_hit_regions.links) {
                if (ctx.isPointInPath(l.path, x, y)) {
                    if (target_cd === 'all') {
                        target_cd = l.id.split('|')[0]; 
                    }
                    
                    flow_dir = 'both';
                    clicked_something = true;
                    break;
                }
            }
        }

        if (clicked_something) {
            document.querySelectorAll('.ablock').forEach(block => {
                if (block.querySelector('.atitle')?.innerText === 'Timeline') {
                    block.querySelectorAll('.aoption').forEach(opt => {
                        opt.classList.remove('aselect');
                        if (opt.innerText === map_timeline) {
                            opt.classList.add('aselect');
                        }
                    });
                }
            });
            
            document.querySelectorAll('.flow_btn').forEach(b => {
                b.classList.remove('aselect');
                b.style.background = '#333';
                b.style.color = '#aaa';
                if (b.getAttribute('data-flow') === flow_dir) {
                    b.classList.add('aselect');
                    b.style.background = '#4a90e2';
                    b.style.color = '#fff';
                }
            });
            
            request_buffer_update();
        }
    });
}

const request_buffer_update = () => {
    if (update_pending) {
        return;
    }

    update_pending = true;

    requestAnimationFrame(() => {

        draw_map();

        shift_x = 0;
        shift_y = 0;

        render_main();

        update_pending = false;
    });
}

const render_main = () => {
    main_ctx.clearRect(0, 0, main_cv.width, main_cv.height);
    main_ctx.drawImage(buffer, shift_x, shift_y);

    if (map_hover) {
        const h = map_hover;
        const metric = current_metric;
        
        let lines = [
            { text: `Precinct: ${h['PCT_STD'] || 'Unknown'}`, color: '#fff' },
            { text: `County: ${h['COUNTY'] || h['COUNTYFP'] || 'Unknown'}`, color: '#fff' },
            { text: `VAP: ${(h['VAP'] || 0).toLocaleString()}`, color: '#fff' }
        ];
        
        if (metric === 'partisan_lean') {
            lines.push({ text: `Partisan Lean: ${((h[metric]||0)*100).toFixed(1)}%`, color: '#fff' });
        }
        else if (metric === 'turnout_rate') {
            lines.push({ text: `Turnout: ${((h[metric]||0)*100).toFixed(1)}%`, color: '#fff' });
        }
        else if (metric.startsWith('vap_') && metric !== 'all_vap') {
            let col = metric.toUpperCase();
            let pct = h['VAP'] > 0 ? (h[col] || 0) / h['VAP'] : 0;
            lines.push({ text: `${col}: ${(pct*100).toFixed(1)}%`, color: '#fff' });
        }
        else if (metric === 'all_vap') {
            let total = h['VAP'] || 0;
            demographics.forEach(dem => {
                let val = 0;
                if (dem.key === 'other') {
                    let accounted = (h['VAP_BLACK']||0) + (h['VAP_ASIAN']||0) + (h['VAP_AIAN']||0) + (h['VAP_NHPI']||0);
                    val = Math.max(0, total - accounted);
                } 
                else {
                    val = h[dem.key.toUpperCase()] || 0;
                }
                let pct = total > 0 ? val / total : 0;
                let label = dem.key.replace('vap_', '').toUpperCase();
                
                lines.push({ text: `${label}: ${(pct*100).toFixed(1)}%`, color: dem.color.replace('0.7)', '1.0)') });
            });
        }
        
        main_ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        main_ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        main_ctx.lineWidth = 1;
        
        let box_w = 140;
        let box_h = 10 + (lines.length * 16);
        let x = map_hover_pos.x + 15;
        let y = map_hover_pos.y + 15;
        
        if (x + box_w > main_cv.width) {
            x -= (box_w + 30);
        }
        if (y + box_h > main_cv.height) {
            y -= (box_h + 30);
        }
        
        main_ctx.fillRect(x, y, box_w, box_h);
        main_ctx.strokeRect(x, y, box_w, box_h);
        
        main_ctx.font = '11px sans-serif';
        main_ctx.textAlign = 'left';
        main_ctx.textBaseline = 'top';
        
        lines.forEach((line, i) => {
            main_ctx.fillStyle = line.color;
            main_ctx.fillText(line.text, x + 10, y + 8 + (i * 16));
        });
    }
}

// .---------------------------------.
// |         EVENT LISTENERS         |
// '---------------------------------'

addEventListener('load', () => {
    console.log('page loaded');
    load();
});

console.log('idx.js loaded');