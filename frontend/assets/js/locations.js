// Hòa Bình Locations Data (Hòa Bình Pharmacy - Local Delivery Only)
// Giao hàng chỉ trong phạm vi tỉnh Hòa Bình
const LOCATIONS_DATA = {
  "Hòa Bình": {
    "Thành phố Hòa Bình": [
      "Phường Hòa Bình", "Phường Tây Mỗ", "Phường Lá Phù", "Phường Tây Đằng",
      "Xã Đông Phương", "Xã Bắc Phương", "Xã Hương Sơn"
    ],
    "Hương Sơn": [
      "Thị trấn Kỳ Sơn", "Xã Hương Sơn", "Xã Liên Sơn", "Xã Hương Nguyên", 
      "Xã Kiền Xương", "Xã Trạm Tấu", "Xã Hương Điền", "Xã Hương Canh"
    ],
    "Kim Bôi": [
      "Thị trấn Kim Bôi", "Xã Kim Sơn", "Xã Bình Phúc", "Xã Đông Phong",
      "Xã Tây Phong", "Xã Hạ Bằng", "Xã Thượng Bằng", "Xã Tây Bằng"
    ],
    "Lạc Sơn": [
      "Thị trấn Lạc Sơn", "Xã Lạc Dương", "Xã Mông Hóa", "Xã Kim Bôi",
      "Xã Thôi Sơn", "Xã Song Sơn", "Xã Trấn Yên", "Xã Bắc Sơn"
    ],
    "Lạc Thủy": [
      "Thị trấn Lạc Thủy", "Xã Hòa Sơn", "Xã Mộc Châu", "Xã Yên Lạc",
      "Xã Tiến Thắng", "Xã Bình Phúc", "Xã Minh Hóa", "Xã Thượng Vinh"
    ],
    "Yên Thủy": [
      "Thị trấn Yên Thủy", "Xã Yên Bản", "Xã Yên Hòa", "Xã Trung Lương",
      "Xã Đại Bạch", "Xã Dương Lâm", "Xã Dân Hòa", "Xã Long Hòa"
    ],
    "Tân Lạc": [
      "Thị trấn Tân Lạc", "Xã Tân Sơn", "Xã Trung Mỹ", "Xã Phú Sơn",
      "Xã Tây Mỗ", "Xã Chiêu Thuỷ", "Xã Văn Hòa", "Xã Định Mỹ"
    ],
    "Cao Phong": [
      "Thị trấn Cao Phong", "Xã Cao Sơn", "Xã Nam Sơn", "Xã Bắc Mỹ",
      "Xã Tây Yên", "Xã Phú Vinh", "Xã Thượng Hiền", "Xã Hạ Hiền"
    ],
    "Đà Bắc": [
      "Thị trấn Đà Bắc", "Xã Đà Sơn", "Xã Đào Xuyên", "Xã Chu Tự",
      "Xã Yên Mỹ", "Xã Chân Mây", "Xã Hòa Sơn", "Xã Ao Tuần"
    ]
  }
};

// Get list of provinces (chỉ Hòa Bình)
function getProvinces() {
  return Object.keys(LOCATIONS_DATA).sort();
}

// Get list of districts by province
function getDistricts(province) {
  return LOCATIONS_DATA[province] ? Object.keys(LOCATIONS_DATA[province]).sort() : [];
}

// Get list of wards by province & district
function getWards(province, district) {
  return LOCATIONS_DATA[province] && LOCATIONS_DATA[province][district] 
    ? LOCATIONS_DATA[province][district].sort() 
    : [];
}

// Filter items by search query
function filterItems(items, query) {
  if (!query) return items;
  return items.filter(item => 
    item.toLowerCase().includes(query.toLowerCase())
  );
}
