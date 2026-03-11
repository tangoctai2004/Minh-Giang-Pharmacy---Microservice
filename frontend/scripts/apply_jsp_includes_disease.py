import re

filepath = 'disease.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Header replacements
content = re.sub(r'<!-- Header Banner -->.*?<!-- Top Bar -->', '<!-- Header Banner -->\n    <%@include file="includes/header_banner.jsp" %>\n\n    <!-- Top Bar -->', content, flags=re.DOTALL)
content = re.sub(r'<!-- Top Bar -->.*?<!-- Main Header -->', '<!-- Top Bar -->\n    <%@include file="includes/top_bar.jsp" %>\n\n    <!-- Main Header -->', content, flags=re.DOTALL)
content = re.sub(r'<!-- Main Header -->.*?</header>', '<!-- Main Header -->\n    <%@include file="includes/main_header.jsp" %>', content, flags=re.DOTALL)

# Bottom sections replacements (specific to disease.html)
content = re.sub(r'<!-- Disease Groups -->\s*<div class="disease-groups">.*?<!-- Top Searches -->', '<!-- Disease Groups -->\n        <%@include file="includes/disease_groups.jsp" %>\n\n        <!-- Top Searches -->', content, flags=re.DOTALL)
content = re.sub(r'<!-- Top Searches -->\s*<div class="top-searches">.*?</main>', '<!-- Top Searches -->\n        <%@include file="includes/top_searches.jsp" %>\n    </main>', content, flags=re.DOTALL)

# Footer replacements
content = re.sub(r'<!-- Pre-Footer Promises -->.*?<!-- Newsletter -->', '<!-- Pre-Footer Promises -->\n    <%@include file="includes/promises.jsp" %>\n\n    <!-- Newsletter -->', content, flags=re.DOTALL)
content = re.sub(r'<!-- Newsletter -->.*?<!-- Main Footer -->', '<!-- Newsletter -->\n    <%@include file="includes/newsletter.jsp" %>\n\n    <!-- Main Footer -->', content, flags=re.DOTALL)
content = re.sub(r'<!-- Main Footer -->.*?</footer>', '<!-- Main Footer -->\n    <%@include file="includes/main_footer.jsp" %>', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated disease.html successfully")
