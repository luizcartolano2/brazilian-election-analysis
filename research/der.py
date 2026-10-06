import sys
def read_tlv(buf, pos):
    tag = buf[pos]; pos += 1
    cls, constructed, num = tag >> 6, bool(tag & 0x20), tag & 0x1f
    if num == 0x1f:
        num = 0
        while True:
            b = buf[pos]; pos += 1; num = (num << 7) | (b & 0x7f)
            if not b & 0x80: break
    length = buf[pos]; pos += 1
    if length & 0x80:
        n = length & 0x7f; length = int.from_bytes(buf[pos:pos+n], "big"); pos += n
    return cls, constructed, num, buf[pos:pos+length], pos + length

def parse(buf):
    pos, out = 0, []
    while pos < len(buf):
        cls, constructed, num, val, pos = read_tlv(buf, pos)
        node = {"cls": cls, "num": num}
        if constructed:
            node["children"] = parse(val)
        else:
            node["raw"] = val
            # OCTET STRINGs that wrap a nested DER envelope
            if cls == 0 and num == 4 and len(val) > 2 and val[0] == 0x30:
                try: node["children"] = parse(val)
                except Exception: pass
        out.append(node)
    return out

def show(nodes, depth=0, limit=400, counter=[0]):
    for node in nodes:
        counter[0] += 1
        if counter[0] > limit: return
        label = f"{'U' if node['cls']==0 else 'C'}{node['num']}"
        if "children" in node:
            print("  "*depth + label + f" [{len(node['children'])}]")
            show(node["children"], depth+1, limit, counter)
        else:
            raw = node["raw"]
            if node["cls"] == 0 and node["num"] in (2, 10): text = int.from_bytes(raw, "big", signed=True)
            elif all(32 <= b < 127 for b in raw) and raw: text = repr(raw.decode())
            else: text = raw[:16].hex() + ("..." if len(raw) > 16 else "") + f" ({len(raw)}B)"
            print("  "*depth + f"{label} = {text}")

if __name__ == "__main__":
    show(parse(open(sys.argv[1], "rb").read()), limit=int(sys.argv[2]) if len(sys.argv) > 2 else 400)
