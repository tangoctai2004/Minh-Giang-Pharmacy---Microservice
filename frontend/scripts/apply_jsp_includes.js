const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'benh-chuyen-khoa.html');
let content = fs.readFileSync(filePath, 'utf8');

// Header
content = content.replace(/<!-- Header Banner -->[\s\S]*?<!-- Top Bar -->/, '<!-- Header Banner -->\n    <%@include file="includes/header_banner.jsp" %>\n\n    <!-- Top Bar -->');
content = content.replace(/<!-- Top Bar -->[\s\S]*?<!-- Main Header -->/, '<!-- Top Bar -->\n    <%@include file="includes/top_bar.jsp" %>\n\n    <!-- Main Header -->');
content = content.replace(/<!-- Main Header -->[\s\S]*?<\/header>/, '<!-- Main Header -->\n    <%@include file="includes/main_header.jsp" %>');

// Bottom Sections
content = content.replace(/<!-- Tra cứu theo nhóm bệnh -->[\s\S]*?<!-- Tìm kiếm hàng đầu -->/, '<!-- Tra cứu theo nhóm bệnh -->\n            <%@include file="includes/disease_groups.jsp" %>\n\n            <!-- Tìm kiếm hàng đầu -->');
content = content.replace(/<!-- Tìm kiếm hàng đầu -->[\s\S]*?<!-- SẢN PHẨM ĐANG THU HÚT -->/, '<!-- Tìm kiếm hàng đầu -->\n            <%@include file="includes/top_searches.jsp" %>\n\n            <!-- SẢN PHẨM ĐANG THU HÚT -->');
content = content.replace(/<!-- SẢN PHẨM ĐANG THU HÚT -->[\s\S]*?<\/main>/, '<!-- SẢN PHẨM ĐANG THU HÚT -->\n            <%@include file="includes/featured_products.jsp" %>\n\n        </div>\n    </main>');

// Footers
content = content.replace(/<!-- Pre-Footer Promises -->[\s\S]*?<!-- Newsletter -->/, '<!-- Pre-Footer Promises -->\n    <%@include file="includes/promises.jsp" %>\n\n    <!-- Newsletter -->');
content = content.replace(/<!-- Newsletter -->[\s\S]*?<!-- Main Footer -->/, '<!-- Newsletter -->\n    <%@include file="includes/newsletter.jsp" %>\n\n    <!-- Main Footer -->');
content = content.replace(/<!-- Main Footer -->[\s\S]*?<\/footer>/, '<!-- Main Footer -->\n    <%@include file="includes/main_footer.jsp" %>');

fs.writeFileSync(filePath, content);
console.log("Successfully updated benh-chuyen-khoa.html");
