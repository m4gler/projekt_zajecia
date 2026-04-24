import sys
import json
import os

def process_file(file_path):
    try:
        import cadquery as cq
        from OCP.BRepMesh import BRepMesh_IncrementalMesh
        from OCP.BRep import BRep_Tool
        from OCP.TopAbs import TopAbs_FACE
        from OCP.TopExp import TopExp_Explorer
    except ImportError:
        return {"error": "CadQuery not installed or accessible"}

    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}
# 
    try:
        shape = cq.importers.importStep(file_path)
    except Exception as e:
        return {"error": f"Failed to load STEP: {str(e)}"}

    if hasattr(shape, "val"):
        shape_val = shape.val()
    else:
        shape_val = shape

    BRepMesh_IncrementalMesh(shape_val.wrapped, 0.1, True, 0.1, True)
    
    vertices = []
    normals = []
    indices = []
    
    explorer = TopExp_Explorer(shape_val.wrapped, TopAbs_FACE)
    index_offset = 0
    
    while explorer.More():
        from OCP.TopoDS import TopoDS
        face = TopoDS.Face_s(explorer.Current())
        location = face.Location()
        triangulation = BRep_Tool.Triangulation_s(face, location)
        
        if triangulation is not None:
            for i in range(1, triangulation.NbNodes() + 1):
                p = triangulation.Node(i).Transformed(location.Transformation())
                vertices.extend([p.X(), p.Y(), p.Z()])
                normals.extend([0, 0, 1]) 

            for i in range(1, triangulation.NbTriangles() + 1):
                t = triangulation.Triangle(i)
                i1, i2, i3 = t.Get()
                indices.extend([i1 - 1 + index_offset, i2 - 1 + index_offset, i3 - 1 + index_offset])
            
            index_offset += triangulation.NbNodes()
        
        explorer.Next()

    # Extract parts
    raw_parts = []
    try:
        solids = shape.solids().vals()
        for i, solid in enumerate(solids):
            bbox = solid.BoundingBox()
            volume = solid.Volume()
            
            dx, dy, dz = bbox.xlen, bbox.ylen, bbox.zlen
            
            category = "other"
            if volume < 8000:
                category = "connector"
            elif max(dx, dy, dz) > 80 and min(dx, dy, dz) < 50:
                category = "panel"
            
            raw_parts.append({
                "id": i,
                "volume": volume,
                "dimensions": {"x": dx, "y": dy, "z": dz},
                "category": category,
                "center": [bbox.center.x, bbox.center.y, bbox.center.z]
            })
    except Exception as e:
        pass

    # Grouping identical parts
    grouped_parts = []
    for part in raw_parts:
        found = False
        for group in grouped_parts:
            ref = group["representative"]
            # Tolerance 15%
            vol_diff = abs(part["volume"] - ref["volume"]) / (ref["volume"] or 1)
            
            dims_p = sorted([part["dimensions"]["x"], part["dimensions"]["y"], part["dimensions"]["z"]])
            dims_r = sorted([ref["dimensions"]["x"], ref["dimensions"]["y"], ref["dimensions"]["z"]])
            dim_diffs = [abs(p - r) / (r or 1) for p, r in zip(dims_p, dims_r)]
            
            if vol_diff < 0.15 and all(d < 0.15 for d in dim_diffs):
                group["count"] += 1
                group["ids"].append(part["id"])
                found = True
                break
        
        if not found:
            grouped_parts.append({
                "representative": part,
                "count": 1,
                "ids": [part["id"]]
            })

    return {
        "success": True,
        "geometry": {
            "vertices": vertices,
            "normals": normals,
            "indices": indices
        },
        "parts": raw_parts,
        "groupedParts": grouped_parts
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path"}))
        sys.exit(1)
        
    result = process_file(sys.argv[1])
    print(json.dumps(result))
