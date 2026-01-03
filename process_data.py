import pandas as pd
import json
import numpy as np

# 1. Define City-County Mapping (Shandong)
city_map = {
    "济南市": ["济南", "历下", "市中", "槐荫", "天桥", "历城", "长清", "章丘", "济阳", "莱芜", "钢城", "平阴", "商河"],
    "青岛市": ["青岛", "市南", "市北", "黄岛", "西海岸", "崂山", "李沧", "城阳", "即墨", "胶州", "平度", "莱西"],
    "淄博市": ["淄博", "淄川", "张店", "博山", "临淄", "周村", "桓台", "高青", "沂源"],
    "枣庄市": ["枣庄", "薛城", "峄城", "台儿庄", "山亭", "滕州"],
    "东营市": ["东营", "河口", "垦利", "利津", "广饶"],
    "烟台市": ["烟台", "芝罘", "福山", "牟平", "莱山", "蓬莱", "龙口", "莱阳", "莱州", "招远", "栖霞", "海阳", "长岛"],
    "潍坊市": ["潍坊", "潍城", "寒亭", "坊子", "奎文", "青州", "诸城", "寿光", "安丘", "高密", "昌邑", "临朐", "昌乐"],
    "济宁市": ["济宁", "任城", "兖州", "曲阜", "邹城", "微山", "鱼台", "金乡", "嘉祥", "汶上", "泗水", "梁山"],
    "泰安市": ["泰安", "泰山", "岱岳", "新泰", "肥城", "宁阳", "东平"],
    "威海市": ["威海", "环翠", "文登", "荣成", "乳山"],
    "日照市": ["日照", "东港", "岚山", "五莲", "莒县"],
    "临沂市": ["临沂", "兰山", "河东", "罗庄", "沂南", "郯城", "沂水", "兰陵", "费县", "平邑", "莒南", "蒙阴", "临沭", "银雀山"],
    "德州市": ["德州", "德城", "陵城", "陵县", "乐陵", "禹城", "宁津", "庆云", "临邑", "齐河", "平原", "夏津", "武城"],
    "聊城市": ["聊城", "东昌府", "茌平", "临清", "阳谷", "莘县", "东阿", "冠县", "高唐"],
    "滨州市": ["滨州", "滨城", "沾化", "邹平", "惠民", "阳信", "无棣", "博兴"],
    "菏泽市": ["菏泽", "牡丹", "定陶", "曹县", "单县", "成武", "巨野", "郓城", "鄄城", "东明"]
}

def get_city(museum_name):
    if not isinstance(museum_name, str):
        return "其他"
    
    # Check for direct city name match
    for city, counties in city_map.items():
        if city in museum_name:
            return city
            
    # Check for county name match
    for city, counties in city_map.items():
        for county in counties:
            if county in museum_name:
                return city
                
    return "其他"

def process_data():
    print("Loading Excel data...")
    df = pd.read_excel('山东省博物馆彩陶信息.xlsx')
    
    # 2. Data Cleaning & Advanced Filtering
    print("Cleaning and Filtering data...")
    
    # Map cities
    df['city'] = df['museumName'].apply(get_city)
    
    # Fill NaN
    df['clickCounts'] = df['clickCounts'].fillna(0)
    df['name'] = df['name'].fillna("未命名")
    df['description'] = df['description'].fillna("暂无描述")
    df['yearName'] = df['yearName'].fillna("年代不详")
    
    # --- FILTER: Keep only "Neolithic Painted Pottery" (新石器时代彩陶) ---
    # Logic: 
    # 1. Year must contain "新石器", "大汶口", or "龙山"
    # 2. Name/Desc must contain "彩" or "彩绘" (Strict painted pottery)
    
    mask_era = df['yearName'].str.contains('新石器', na=False) | \
               df['yearName'].str.contains('大汶口', na=False) | \
               df['yearName'].str.contains('龙山', na=False)
               
    mask_painted = df['name'].str.contains('彩', na=False) | \
                   df['description'].str.contains('彩绘', na=False) | \
                   df['name'].str.contains('三彩', na=False) # Keep strict
                   
    df_neolithic = df[mask_era & mask_painted].copy()
    
    print(f"Filtered {len(df_neolithic)} Neolithic Painted Pottery items from {len(df)} total items.")
    
    # --- CATEGORIZATION: Shape (Form) ---
    # Extract last character of name, filter for common pottery shapes
    common_shapes = ['罐', '壶', '盆', '钵', '鼎', '鬶', '豆', '俑', '炉', '盘', '尊', '瓶', '枕', '杯', '盉']
    
    def map_shape(name):
        clean_name = name.strip()
        # Prioritize explicit shape keywords
        found_shape = None
        for s in common_shapes:
            if s in clean_name:
                found_shape = s
                # Continue checking to find the *last* matching keyword? 
                # Actually, usually the last char is the shape.
        
        if clean_name and clean_name[-1] in common_shapes:
            return clean_name[-1]
            
        return found_shape if found_shape else '其他'

    df_neolithic['shape_type'] = df_neolithic['name'].apply(map_shape)
    
    # Use the filtered dataset for the visualization
    df = df_neolithic

    # 3. Aggregation (Group Perspective)
    print("Aggregating stats...")
    
    # Basic city stats
    city_stats = df.groupby('city').agg({
        'id': 'count',
        'clickCounts': 'sum'
    }).reset_index().rename(columns={'id': 'count'})
    
    # --- MULTI-DIMENSIONAL STATS ---
    
    # By Shape
    stats_by_shape = df.pivot_table(index='city', columns='shape_type', values='id', aggfunc='count', fill_value=0).to_dict(orient='index')
    
    # Global Lists for UI
    all_shapes = df['shape_type'].value_counts().index.tolist() # Sorted by frequency
    
    # --- NAME DISTRIBUTION (For "Same Name" feature) ---
    # Group by Name, list all cities where it appears
    name_distribution = df.groupby('name')['city'].apply(list).to_dict()
    
    # --- SANKEY DATA (City -> Shape) ---
    sankey_data = {
        "nodes": [],
        "links": []
    }
    
    # 1. Nodes: Cities and Shapes
    cities = df['city'].unique().tolist()
    shapes = df['shape_type'].unique().tolist()
    
    # Colors or just names? Just names for now.
    sankey_data["nodes"] = [{"name": n} for n in cities + shapes]
    
    # 2. Links: City -> Shape
    link_df = df.groupby(['city', 'shape_type']).size().reset_index(name='value')
    sankey_data["links"] = link_df.to_dict(orient='records')
    # Change keys to source/target
    sankey_data["links"] = [{"source": r['city'], "target": r['shape_type'], "value": int(r['value'])} for r in sankey_data["links"]]

    # Prepare detailed city data for the dashboard
    city_details = {}
    for city in df['city'].unique():
        city_df = df[df['city'] == city]
        
        # All items in this city (for gallery)
        items = city_df.sort_values('clickCounts', ascending=False)[['name', 'imgUrl', 'clickCounts', 'shape_type', 'description', 'museumName']].to_dict(orient='records')
        
        city_details[city] = {
            "items": items,
            "shape_distribution": city_df['shape_type'].value_counts().reset_index().values.tolist(),
            "total_count": int(len(city_df)),
            "total_clicks": int(city_df['clickCounts'].sum())
        }

    # 4. Individual Selection (Individual Perspective)
    # Just pick the global top one as default protagonist
    protagonist = df.loc[df['clickCounts'].idxmax()].to_dict()
    
    # Calculate Percentiles within Painted Pottery
    total_items = len(df)
    rank = df['clickCounts'].rank(pct=True)
    protagonist_rank = rank.loc[df['clickCounts'].idxmax()]
    
    # 5. Export JSON
    output_data = {
        "summary": {
            "total_count": int(total_items),
            "total_clicks": int(df['clickCounts'].sum())
        },
        "dimensions": {
            "shapes": all_shapes
        },
        "city_stats": city_stats.to_dict(orient='records'),
        "stats_by_shape": stats_by_shape,
        "name_distribution": name_distribution,
        "sankey_data": sankey_data,
        "city_details": city_details,
        "protagonist": {
            "info": protagonist,
            "stats": {
                "rank_percentile": float(protagonist_rank),
                "type_rarity": f"{len(df[df['shape_type'] == protagonist['shape_type']])}/{total_items}"
            }
        },
        "all_items": df[['name', 'city', 'museumName', 'clickCounts', 'imgUrl', 'description', 'shape_type', 'yearName']].sort_values('clickCounts', ascending=False).to_dict(orient='records')
    }
    
    # Handle int64 serialization and NaN
    class CustomEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                if np.isnan(obj): return None
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return super(CustomEncoder, self).default(obj)

    def clean_nan(obj):
        if isinstance(obj, float) and np.isnan(obj):
            return None
        if isinstance(obj, dict):
            return {k: clean_nan(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [clean_nan(i) for i in obj]
        return obj

    output_data = clean_nan(output_data)

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, cls=CustomEncoder, indent=2)
        
    print("Data processing complete. Saved to data.json")

if __name__ == "__main__":
    process_data()
