# **CodeMonkey** — AI Code Review theo ngữ cảnh toàn bộ repository

> *Review pull request thông minh, hiểu cả codebase chứ không chỉ đọc mỗi diff.*

---

## 📌 Mục lục

- [Vấn đề mình giải quyết](#-vấn-đề-mình-giải-quyết)
- [CodeMonkey hoạt động như thế nào](#-codemonkey-hoạt-động-như-thế-nào)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [So sánh với LAURA](#-so-sánh-với-laura)
- [AI & Code Processing](#-ai--code-processing)
- [Đánh giá chất lượng](#-đánh-giá-chất-lượng)
- [Hướng dẫn bắt đầu](#-hướng-dẫn-bắt-đầu)
- [Setup Development Environment](#-setup-development-environment)
- [Cấu hình](#-cấu-hình)
- [Gói sử dụng](#-gói-sử-dụng)
- [Bảo mật & quyền riêng tư](#-bảo-mật--quyền-riêng-tư)
- [Demo](#-demo)
- [Dành cho sinh viên và người mới học lập trình](#-dành-cho-sinh-viên-và-người-mới-học-lập-trình)
- [Kết quả mong đợi & cách kiểm thử](#-kết-quả-mong-đợi--cách-kiểm-thử)
- [Hỗ trợ & phản hồi](#-hỗ-trợ--phản-hồi)
- [Giấy phép](#-giấy-phép)

---

## 🎯 Vấn đề mình giải quyết

**Reviewer AI chỉ đọc diff thường rất dễ thiếu ngữ cảnh.** Khi không hiểu cấu trúc repository, comment sinh ra dễ chung chung, trùng với lint, hoặc tệ hơn là kết luận sai.

CodeMonkey giải quyết bằng cách:
- ✅ Lập chỉ mục toàn bộ repository để hiểu cấu trúc, quy ước và quan hệ giữa các file
- ✅ Truy xuất ngữ cảnh liên quan trước khi review để không phán đoán mù
- ✅ Bám vào bằng chứng từ diff + context thay vì suy diễn
- ✅ Ưu tiên vấn đề theo mức độ ảnh hưởng: blocker, quan trọng, cải tiến
- ✅ Đưa ra gợi ý có thể làm ngay

Kết quả là review có cảm giác như một senior developer đã đọc qua cả codebase của bạn.

---

## 🚀 CodeMonkey hoạt động như thế nào

### **Luồng 3 bước**

| Bước | Hành động | Mô tả |
|------|-----------|-------|
| **1️⃣ Kết nối** | Lập chỉ mục repository | Mở **Repositories**, bấm **Connect**. CodeMonkey tạo chỉ mục ngữ nghĩa từ mã nguồn của bạn. |
| **2️⃣ Review** | Tự động review PR | Khi có PR mới, CodeMonkey đọc diff, lấy context liên quan và đăng nhận xét. |
| **3️⃣ Lặp lại** | Push và review lại | Sửa lỗi, push commit mới, hệ thống chạy lại với ngữ cảnh cập nhật. |

### **Bên trong hệ thống**

```text
GitHub PR Webhook
	↓
Next.js (Webhook Handler) → Inngest (Queue)
	↓
Python FastAPI (xử lý AI)
	├─ Fetch PR diff
	├─ Retrieve code context (Pinecone RAG)
	├─ Generate review (Gemini LLM)
	├─ Evaluate quality (TruLens)
	└─ Store metadata
	↓
Callback về Next.js API
	↓
GitHub Comment (Review Posted)
```

---

## 🏗️ Kiến trúc hệ thống

CodeMonkey được trình bày theo hướng **monolithic**: một sản phẩm thống nhất, nơi UI, xác thực, webhook, orchestration và phần xử lý AI cùng phục vụ một luồng trải nghiệm xuyên suốt.

```text
┌────────────────────────────────────────────────────────────────────┐
│ CodeMonkey Application (Monolithic Product View)                  │
├────────────────────────────────────────────────────────────────────┤
│ ✓ GitHub OAuth login                                               │
│ ✓ Polar payments (checkout, portal)                                │
│ ✓ Webhook handlers (GitHub, Polar)                                 │
│ ✓ Inngest orchestration (task queue)                               │
│ ✓ PostgreSQL (user, repo, review data)                             │
│ ✓ UI Dashboard (React)                                             │
│ ✓ AI review pipeline (indexing, retrieval, generation, scoring)    │
└────────────────────────────────────────────────────────────────────┘
```

### **Luồng xử lý nội bộ**

1. Người dùng kết nối repository.
2. Hệ thống lập chỉ mục mã nguồn và lưu ngữ cảnh.
3. Khi có PR mới, hệ thống lấy diff và truy xuất ngữ cảnh liên quan.
4. Gemini sinh review dựa trên diff + context.
5. Kết quả được chấm chất lượng trước khi hiển thị hoặc đăng comment.

### **Điểm cần hiểu đúng**

- Kiến trúc được mô tả theo góc nhìn monolithic để dễ đọc, dễ giải thích, và dễ bảo trì cho người mới.
- Bên trong, các luồng xử lý vẫn được tách theo chức năng để code rõ ràng và dễ mở rộng.
- Mục tiêu là một ứng dụng thống nhất, không phải chia nhỏ trải nghiệm của người dùng thành nhiều hệ thống rời rạc.

---

## 🧭 So sánh với LAURA (Enhancing Code Review Generation with Context-Enriched Retrieval-Augmented LLM Paper)

LAURA là nền tảng tư duy cho phần review của CodeMonkey. CodeMonkey giữ tinh thần của LAURA nhưng trình bày và triển khai theo ngữ cảnh sản phẩm riêng.

| LAURA | CodeMonkey |
|-------|------------|
| Đọc diff + truy xuất context | Đọc diff + lập chỉ mục repository để lấy context liên quan |
| Tập trung vào phân tích grounded | Tập trung vào review có bằng chứng, dễ kiểm tra |
| Kết luận từ context đã thu thập | Kết luận gắn với cấu trúc codebase thật của project |
| Output review có kiểm soát | Output review được chấm chất lượng trước khi đưa ra người dùng |
| Tư duy review theo ngữ cảnh | Trải nghiệm sản phẩm end-to-end cho người dùng web |

### **CodeMonkey kế thừa gì từ LAURA?**

- Tìm context liên quan trước khi kết luận.
- Chống false positive bằng cách không đoán nếu thiếu dữ liệu.
- Ưu tiên tính hữu ích và tính hành động của review.
- Chia output thành phần phân tích và phần nhận xét cuối cùng.

### **CodeMonkey bổ sung gì?**

- Trải nghiệm người dùng hoàn chỉnh trên web.
- Dashboard, subscription, webhook, lịch sử review.
- Kiểm tra chất lượng review bằng metric nội bộ.
- Phù hợp hơn với nhóm sản phẩm cần theo dõi và vận hành thực tế.

---

## 🧩 AI & Code Processing

### **AI & Code Processing**
- **Python 3.x**
- **FastAPI**
- **Modal**
- **Google GenAI**
- **Pinecone**
- **Tree-sitter**

### **Optional LLM Fallbacks**
- Deepseek v4 Flash
- OpenRouter (nhiều model khác nhau)
- Nvidia NIM (Llama 3.3 70B)

### **Quality Assurance**
- **TruLens** (LLM evaluation framework)
- **Custom metrics** (groundedness, relevance, actionability, etc.)

---

## 📊 Đánh giá chất lượng

Mỗi review được đánh giá tự động theo **7 chiều chất lượng**:

### **Các chỉ số do LLM chấm (thang 0–5)**

| Metric | Good Threshold | Meaning |
|--------|---|---|
| **Groundedness** | ≥ 4.0 | Nhận xét có bằng chứng từ diff/context, không suy diễn |
| **Relevance** | ≥ 4.0 | Bình luận bám vào PR và phần code thay đổi |
| **Context Relevance** | ≥ 3.5 | Context truy xuất ra thực sự hữu ích cho việc hiểu PR |
| **Actionability** | ≥ 3.5 | Gợi ý cụ thể, đúng file, có thể triển khai ngay |
| **False Positive Risk** | ≤ 2.0 | *Càng thấp càng tốt* - giảm tối đa nhận xét sai |
| **Readability** | ≥ 3.5 | Rõ ràng, dễ đọc, dễ theo dõi |
| **Brevity** | ≥ 3.0 | Ngắn gọn mà không mất ý chính |

### **Chỉ số metadata (tham khảo)**

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Code Churn Ratio** | `(additions + deletions) / total_lines` | Chỉ báo độ lớn/độ phức tạp của PR |
| **Review Coverage** | `changed_lines_mentioned / total_changed_lines` | % PR đã được phân tích |
| **Suggestion Density** | `suggestion_count / (file_count * 10)` | Mật độ review theo file |

### **Dashboard & export**

Truy cập các chỉ số qua:
- 📊 **GET** `/api/reviews/eval-report` — trả về JSON metrics + legend
- 📥 **CSV Export** — tải toàn bộ review kèm metrics (UTF-8 BOM để mở bằng Excel)

---

## 🎬 Hướng dẫn bắt đầu

### **Điều kiện cần**

1. **GitHub Account** — repo public hoặc private

### **Bước 1: Kết nối repository**

1. Đăng nhập CodeMonkey bằng GitHub OAuth.
2. Mở mục **Repositories**.
3. Chọn repo cần kết nối.
4. Bấm **Connect** ở góc trên bên phải.
5. Chờ hệ thống lập chỉ mục hoàn tất (thường khoảng 30–120 giây tùy repo).

> **⚠️ Lưu ý:** Quá trình lập chỉ mục đọc cấu trúc repository và lưu ngữ cảnh mã nguồn. Nó **không** clone repo về máy bạn; mọi thứ đi qua GitHub API.

### **Bước 2: Tạo pull request**

Tạo nhánh test và mở PR:

```bash
# Tạo và chuyển sang nhánh mới
git checkout -b feature/test-codemonkey

# Thay đổi nhỏ để test
echo "# Test PR for CodeMonkey" >> README.md

# Stage và commit
git add .
git commit -m "docs: test CodeMonkey review"

# Push lên GitHub
git push origin feature/test-codemonkey
```

Sau đó trên GitHub:
1. Mở tab **Pull requests**.
2. Bấm **New pull request**.
3. Chọn **base** = `main`, **compare** = `feature/test-codemonkey`.
4. Bấm **Create pull request**.

### **Bước 3: Chờ review**

CodeMonkey tự động:
1. Nhận webhook của PR.
2. Lấy diff và context liên quan.
3. Sinh review bằng Gemini.
4. Chấm chất lượng bằng TruLens.
5. Đăng comment vào thread của PR.

Hãy chờ comment **AI CodeMonkey Review** trong khoảng 30–90 giây.

### **Bước 4: Lặp lại**

- 💡 Đọc kết quả review
- 🔧 Sửa các vấn đề được nêu
- 🔄 Push commit mới, CodeMonkey sẽ review lại
- ✅ Merge khi đã ổn

---

## 🛠️ Setup Development Environment

### **Yêu cầu hệ thống**

- **Git** — để clone repo
- **Node.js 18+** — cho phần frontend
- **Python 3.9+** — cho phần backend
- **Bun** — package manager cho Node.js (thay thế npm/yarn)
- **PostgreSQL 14+** — database

### **Bước 1: Clone repository từ GitHub**

1. Vào [GitHub CodeMonkey Repository](https://github.com/luluchi19/CodeMonkey)
2. Bấm nút **Code** (xanh lá)
3. Chọn **HTTPS** hoặc **SSH** (khuyến nghị dùng SSH nếu đã setup)
4. Copy link
5. Chạy lệnh:

```bash
# Clone repo
git clone https://github.com/luluchi19/CodeMonkey.git

# Vào thư mục project
cd CodeMonkey
```

### **Bước 2: Setup Python Backend**

Navigate vào thư mục Python backend và thiết lập virtual environment:

```bash
# Vào thư mục backend
cd python-backend

# Tạo virtual environment
python -m venv .venv

# Activate virtual environment
# Trên Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Trên macOS/Linux (Bash/Zsh):
source .venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# (Nếu muốn dev mode) Cài dependencies phát triển
pip install -r requirements-dev.txt
```

Sau đó, chạy FastAPI server:

```bash
# Chạy uvicorn (development server)
uvicorn modal_app:app --reload --host 0.0.0.0 --port 8000

# Hoặc nếu dùng Modal (production):
modal deploy modal_app.py
```

> **📝 Lưu ý:** Mặc định dev server chạy tại `http://localhost:8000`

### **Bước 3: Setup Node.js Frontend**

Quay lại thư mục gốc và setup frontend:

```bash
# Quay lại thư mục project root
cd ..

# Cài đặt dependencies với Bun
bun install

# Chạy development server
bun run dev
```

> **📝 Lưu ý:** Dev server chạy tại `http://localhost:3000`

### **Bước 4: Cấu hình môi trường (Environment Variables)**

Tạo file `.env.local` trong thư mục gốc:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Polar (Payments)
POLAR_ACCESS_TOKEN=your_polar_token
POLAR_API_KEY=your_polar_api_key

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/codemonkey

# Pinecone (Vector DB)
PINCONE_API_KEY=your_pinecone_api_key
PINCONE_INDEX_NAME=codemonkey-index

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Inngest (Task Queue)
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

Tương tự, tạo file `.env` trong thư mục `python-backend`:

```bash
# Python backend config
MODAL_TOKEN_ID=your_modal_token
MODAL_TOKEN_SECRET=your_modal_secret

PINCONE_API_KEY=your_pinecone_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### **Bước 5: Kiểm tra lại setup**

Sau khi setup xong, kiểm tra xem tất cả services đang chạy:

| Component | URL | Status |
|-----------|-----|--------|
| Frontend (Next.js) | `http://localhost:3000` | ✅ |
| Backend (FastAPI) | `http://localhost:8000` | ✅ |
| Database | PostgreSQL connection | ✅ |

Nếu tất cả đều bật, bạn đã ready để phát triển! 🎉

### **Troubleshooting**

- **Lỗi Python venv:** Hãy chắc bạn đã `activate` virtual environment trước khi chạy lệnh pip
- **Lỗi Bun command not found:** Cài Bun từ https://bun.sh
- **Port 3000/8000 đã bị dùng:** Thay port bằng `-p 3001` hoặc `--port 8001`
- **Database connection failed:** Kiểm tra `DATABASE_URL` trong `.env.local` đúng không

---

## ⚙️ Cấu hình

### **Ngôn ngữ review**

Mặc định review được viết bằng **English**. Nếu muốn chuyển sang **Vietnamese**:

1. Vào **Settings**.
2. Tìm mục **Review language**.
3. Chọn **Vietnamese** hoặc **English**.
4. Lưu lại.

Review tiếp theo sẽ dùng ngôn ngữ bạn chọn.

### **Các phần trong review**

Chọn các phần sẽ xuất hiện trong review cuối cùng:

1. **Settings** → **Review sections**
2. Bật/tắt các phần:
   - ✅ **Walkthrough** — tổng quan thay đổi
   - ✅ **Issues** — vấn đề phát hiện được
   - ✅ **Tests** — gợi ý kiểm thử
   - ✅ **Risk Score** — mức độ rủi ro ước lượng
3. Lưu lại

### **Audit Mode (PRO)**

Kích hoạt kiểm tra review nghiêm ngặt hơn:

1. **Settings** → **Audit mode**
2. Bật **Enable audit mode**

Khi bật, mỗi review sẽ đi qua thêm một vòng đánh giá trước khi đăng. Điều này có thể mất thêm khoảng 10–20 giây nhưng giúp tăng chất lượng cho các PR quan trọng.

---


## 🔒 Bảo mật & quyền riêng tư

### **Cách xử lý mã nguồn**
- ✅ Không lưu nguyên code — chỉ giữ diff và metadata của review
- ✅ Embeddings được **mã hóa** trong Pinecone
- ✅ Webhook được **ký HMAC-SHA256**
- ✅ GitHub tokens được **mã hóa khi lưu trữ**

### **Thời gian lưu trữ dữ liệu**
- Comment và score của review: lưu để phục vụ kiểm tra/audit
- Code embeddings: lưu 30 ngày trong Pinecone
- GitHub tokens: được mã hóa, không chia sẻ cho bên thứ ba

---

## 🎥 Demo

*[Video demo placeholder — ~1–2 min walkthrough of full workflow to be added]*

---

## 👥 Dành cho sinh viên và người mới học lập trình

CodeMonkey được thiết kế để dễ hiểu, dễ thử, và dễ quan sát kết quả. Nếu bạn là sinh viên hoặc người mới bắt đầu, có thể dùng dự án này như một ví dụ thực tế để học các chủ đề sau:

- **Luồng web app hiện đại**: đăng nhập, webhook, hàng đợi tác vụ, callback.
- **Cách AI đọc code**: từ diff sang context rồi mới sinh nhận xét.
- **Cách xây hệ thống review có kiểm soát**: không chỉ sinh text, mà còn chấm chất lượng đầu ra.
- **Cách tách trách nhiệm trong dự án lớn**: UI, dữ liệu, xử lý AI, đánh giá, và hiển thị kết quả.

### **Gợi ý cách học từ dự án**

1. Bắt đầu từ phần **CodeMonkey hoạt động như thế nào** để hiểu luồng tổng thể.
2. Đọc phần **Kiến trúc hệ thống** để nắm cách các khối chức năng liên kết với nhau.
3. Xem phần **So sánh với LAURA** để hiểu CodeMonkey kế thừa tư duy grounded review như thế nào.
4. Mở một PR test nhỏ để xem review được tạo ra ra sao.
5. Đối chiếu comment của AI với thay đổi thật trong code để học cách đọc code có ngữ cảnh.

### **Mục tiêu khi học từ CodeMonkey**

- Hiểu vì sao review AI cần context chứ không chỉ cần model lớn.
- Biết cách thiết kế một pipeline review có kiểm soát.
- Nhận ra sự khác nhau giữa “sinh text” và “tạo review hữu ích”.

---

## ✅ Kết quả mong đợi & cách kiểm thử

Sau khi cập nhật README, bạn sẽ thấy:
- README được viết hoàn toàn bằng tiếng Việt, ngoại trừ tên công nghệ và section AI được giữ lại theo yêu cầu.
- Phần kiến trúc được mô tả theo hướng monolithic, không còn nhắc thuật ngữ cũ.
- Có bảng so sánh trực quan giữa CodeMonkey và LAURA.
- Có thêm phần dành cho sinh viên và người mới học lập trình.
- Có mục kiểm thử để người đọc biết cách dùng thử dự án.

### **Cách tự kiểm tra**

1. Mở `README.md` và dùng tìm kiếm với từ khóa đã bị loại bỏ.
2. Nếu không còn kết quả nào, nghĩa là README đã sạch từ này.
3. Đọc nhanh phần **Kiến trúc hệ thống** để xác nhận giọng văn monolithic.
4. Đọc phần **Dành cho sinh viên và người mới học lập trình** để kiểm tra đã có hướng dẫn học tập rõ ràng.
5. Đọc phần **Kết quả mong đợi & cách kiểm thử** để xác nhận README đã có output mong đợi như bạn yêu cầu.

---

## 🤝 Hỗ trợ & phản hồi

- 📧 **Email:** support@codemonkey.dev
- 💬 **Discord:** [Join community](#)
- 🐛 **Issues:** [GitHub Issues](https://github.com/luluchi19/CodeMonkey)
- 📚 **Docs:** tab **Guide** trong ứng dụng

---

## 📄 Giấy phép

Project này dùng **MIT License** — xem [LICENSE](LICENSE) để biết thêm chi tiết.

**Cập nhật lần cuối:** Tháng 5/2026  
**Version:** 1.0.1  
**Trạng thái:** Production ✅
