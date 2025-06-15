# AI Content Agent - Cẩm Nang Phỏng Vấn

Tài liệu này tổng hợp toàn bộ kiến thức về dự án **AI Content Agent**, được thiết kế để giúp bạn tự tin trả lời các câu hỏi phỏng vấn liên quan đến các công nghệ và kiến trúc được sử dụng.

---

## Phần 1: Tổng Quan & Mục Tiêu Kinh Doanh

### Q: Bạn có thể mô tả ngắn gọn về dự án AI Content Agent không?

**A:** AI Content Agent là một nền tảng **Marketing Automation** thông minh. Mục tiêu chính là **tự động hóa hoàn toàn quy trình tạo và xuất bản nội dung** chất lượng cao lên các nền tảng như WordPress và Facebook.

Nó giải quyết bài toán lớn cho các đội marketing: tiết kiệm thời gian, tối ưu chi phí, duy trì sự nhất quán về thương hiệu và nâng cao chất lượng nội dung bằng cách tận dụng sức mạnh của các mô hình AI hàng đầu.

### Q: Vấn đề kinh doanh cốt lõi mà dự án này giải quyết là gì?

**A:** Dự án giải quyết 3 vấn đề chính:

1.  **Tốn kém về thời gian và nhân lực:** Việc tạo nội dung chất lượng đòi hỏi nhiều giờ nghiên cứu và viết lách.
2.  **Chi phí cao:** Sử dụng các mô hình AI cao cấp như GPT-4 có thể tốn kém.
3.  **Thiếu nhất quán:** Duy trì một giọng văn thương hiệu (brand voice) nhất quán qua nhiều nội dung và người viết khác nhau là một thách thức.

Hệ thống của chúng tôi giải quyết bằng cách:

- **Tự động hóa** việc tạo nội dung chỉ trong vài giây.
- **Tối ưu chi phí** thông qua hệ thống `Hybrid AI`, tự động chọn giữa nhà cung cấp trả phí (OpenAI) và miễn phí (Gemini) dựa trên độ phức tạp của yêu cầu.
- **Đảm bảo sự nhất quán** bằng cách sử dụng các prompt template và cấu hình `Brand Voice` chi tiết.

---

## Phần 2: Kiến Trúc Hệ Thống & Công Nghệ

### Q: Hãy mô tả kiến trúc tổng thể của hệ thống.

**A:** Hệ thống được xây dựng theo kiến trúc **Microservices** và **Event-Driven**, đảm bảo khả năng mở rộng (scalability) và bảo trì (maintainability).

- **Client Layer:** Gồm một **React (TypeScript) Frontend** cung cấp giao diện người dùng.
- **API Gateway (Backend):** Một server **Node.js/Express.js** đóng vai trò là cửa ngõ duy nhất. Nó xử lý routing, authentication (JWT), rate limiting và logging. Đây là trái tim của hệ thống trong phiên bản hiện tại.
- **AI/ML Layer (Core Logic):** Đây là dịch vụ cốt lõi, `HybridAIService.ts`, tích hợp nhiều nhà cung cấp AI (OpenAI, Gemini). Nó không phải là một microservice riêng biệt trong bản dev hiện tại, mà là một service class quan trọng được inject vào controller.
- **Data Layer:** Sử dụng **PostgreSQL (Supabase)** làm cơ sở dữ liệu chính và **Redis** cho caching (theo thiết kế kiến trúc).

_(Sơ đồ từ `technical-architecture.md` là một tham khảo tuyệt vời ở đây)._

### Q: Tech stack chính được sử dụng trong dự án là gì?

**A:**

- **Backend:**
  - **Ngôn ngữ:** TypeScript
  - **Runtime/Framework:** Node.js, Express.js
  - **AI Integration:** `@google/generative-ai` cho Gemini, `openai` cho GPT-4.
  - **Database:** PostgreSQL (conceptual, chưa tích hợp đầy đủ trong dev server).
- **Frontend:**
  - **Framework:** React 18+ (với Vite)
  - **Ngôn ngữ:** TypeScript
  - **UI:** Tailwind CSS, Shadcn UI (conceptual).
  - **API Client:** Axios
- **DevOps & Infrastructure (Conceptual):**
  - **Containerization:** Docker, Docker Compose.
  - **Monitoring:** Prometheus, Grafana.
  - **Scheduling:** BullMQ, Redis.

---

## Phần 3: Backend & Luồng Hoạt Động

### Q: Luồng hoạt động khi người dùng yêu cầu tạo nội dung diễn ra như thế nào?

**A:** Đây là luồng hoạt động chi tiết, liên kết giữa các file:

1.  **Frontend (`ContentGenerator.tsx`):** Người dùng điền thông tin (topic, brand voice,...) và nhấn nút "Generate". Component sẽ gọi hàm `generateContent` từ file `frontend/src/services/api.ts`.

2.  **API Service (`api.ts`):** Hàm `generateContent` tạo một request `POST` đến endpoint `/api/v1/ai/generate` của backend. Request body chứa toàn bộ yêu cầu của người dùng, bao gồm cả `preferredProvider` (openai, gemini, hoặc auto). Axios instance ở đây có timeout được cấu hình (ví dụ: 120 giây) để xử lý các request AI tốn thời gian.

3.  **Backend Server (`dev-server.ts`):**

    - Server Express lắng nghe ở port 3001. Router cho `/api/v1/ai` được định nghĩa trong `backend/src/routes/ai.ts`.
    - Route `POST /generate` sẽ trỏ đến phương thức `generateContent` trong `AIController.ts`.

4.  **Controller (`AIController.ts`):**

    - Phương thức `generateContent` nhận request.
    - Nó gọi đến `this.hybridAIService.generateContent(req.body)`. `HybridAIService` được inject vào controller thông qua constructor (Dependency Injection).

5.  **Service (`HybridAIService.ts`) - **Đây là phần quan trọng nhất\*\*:

    - **Constructor:** Khởi tạo các instance của OpenAI và Gemini client, kiểm tra sự tồn tại của API keys.
    - **`generateContent` method:**
      - **Provider Selection:** Gọi phương thức nội bộ `selectProvider`.
        - Nếu `preferredProvider` là `openai` hoặc `gemini`, nó sẽ ưu tiên chọn nhà cung cấp đó.
        - Nếu `preferredProvider` là `auto` (hoặc không có), nó sẽ gọi `assessComplexity` để đánh giá độ phức tạp của yêu cầu (dựa trên loại content, từ vựng...). Nếu phức tạp > 0.7, chọn OpenAI; ngược lại, chọn Gemini. Đây là logic **tối ưu chi phí và chất lượng**.
        - Có cơ chế fallback nếu nhà cung cấp được chọn gặp lỗi.
      - **Prompt Generation:** Dựa vào yêu cầu, nó xây dựng một prompt chi tiết. Các best practice về prompt engineering từ `docs/best-practices.md` được áp dụng ở đây: xác định `ROLE`, `CONTEXT`, `TASK`, `REQUIREMENTS`, và `OUTPUT FORMAT`.
      - **Call AI API:** Gọi đến API của OpenAI hoặc Gemini với prompt đã tạo.
      - **Response Processing:** Nhận response từ AI, tính toán điểm dễ đọc (`readability score`), và định dạng lại thành cấu trúc JSON chuẩn.
      - **Logging:** Ghi log chi tiết về nhà cung cấp được chọn, thời gian phản hồi, và các chỉ số readability.

6.  **Response Quay Trở Lại:** Kết quả từ `HybridAIService` được trả về qua `AIController`, sau đó qua Express response, và cuối cùng hiển thị trên giao diện của `ContentGenerator.tsx`.

### Q: Hãy giải thích về `HybridAIService` và tại sao nó lại quan trọng.

**A:** `HybridAIService` là bộ não của hệ thống AI. Tầm quan trọng của nó nằm ở 3 điểm:

1.  **Linh hoạt (Flexibility):** Nó không trói buộc hệ thống vào một nhà cung cấp AI duy nhất. Tích hợp cả OpenAI và Gemini giúp hệ thống có khả năng dự phòng (redundancy) và tận dụng điểm mạnh của từng nhà cung cấp.
2.  **Tối ưu Chi phí (Cost Optimization):** Đây là lợi ích kinh doanh lớn nhất. Bằng cách tự động chọn Gemini (miễn phí) cho các tác vụ đơn giản và chỉ dùng OpenAI (trả phí) cho các tác vụ phức tạp, nó giúp giảm đáng kể chi phí vận hành.
3.  **Trao quyền cho người dùng (User Empowerment):** Tính năng chọn thủ công (`manual provider selection`) cho phép người dùng tự quyết định giữa tốc độ/chi phí (Gemini) và chất lượng cao nhất (OpenAI), tùy theo nhu cầu của họ.

### Q: Hệ thống xử lý xác thực (Authentication) như thế nào?

**A:** Theo tài liệu `api-documentation.md` và `technical-architecture.md`, hệ thống được thiết kế để hỗ trợ 2 cơ chế xác thực chính:

1.  **JWT (JSON Web Tokens):**

    - Người dùng đăng nhập bằng email/password (`POST /auth/login`).
    - Server xác thực thông tin và cấp phát một cặp `accessToken` (thời hạn ngắn, ví dụ 15 phút) và `refreshToken` (thời hạn dài).
    - `accessToken` được gửi kèm trong header `Authorization: Bearer <token>` của mỗi request cần xác thực.
    - Khi `accessToken` hết hạn, frontend sẽ dùng `refreshToken` để gọi đến `POST /auth/refresh` và nhận một cặp token mới mà không cần người dùng đăng nhập lại.

2.  **SSO (Single Sign-On) với Google/Microsoft:**
    - Luồng hoạt động theo chuẩn OAuth 2.0.
    - Người dùng nhấn nút "Login with Google".
    - Frontend redirect đến endpoint backend, ví dụ `GET /auth/google`.
    - Backend redirect người dùng đến trang xác thực của Google.
    - Sau khi xác thực, Google redirect về một `callback` URL của backend (`GET /auth/google/callback`) với một authorization code.
    - Backend dùng code này để lấy thông tin user từ Google, sau đó tạo tài khoản (nếu chưa có) và cấp phát JWT token như luồng trên.

---

## Phần 4: Frontend

### Q: Bạn có thể mô tả các thành phần chính trên Frontend không?

**A:** Frontend có 2 thành phần chính:

1.  **`ContentGenerator.tsx`:** Đây là giao diện chính nơi người dùng tương tác để tạo nội dung. Nó bao gồm các form input để nhập `topic`, chọn `brandVoice`, `keywords`, và quan trọng nhất là dropdown để chọn `provider` (Auto, OpenAI, Gemini). Nó cũng chịu trách nhiệm hiển thị kết quả trả về từ AI.
2.  **`AITestPanel.tsx`:** Đây là một dashboard "hậu trường" dành cho developer. Nó dùng để kiểm tra sức khỏe của hệ thống. Nó gọi đến các endpoint health check của backend (`/api/v1/health`, `/api/v1/ai/health`) và hiển thị trạng thái của các dịch vụ, các nhà cung cấp AI có sẵn.

### Q: Frontend giao tiếp với Backend như thế nào?

**A:** Việc giao tiếp được thực hiện thông qua file `frontend/src/services/api.ts`.

- Một **instance của Axios** được tạo ra với `baseURL` trỏ đến địa chỉ của backend (ví dụ: `http://localhost:3001`).
- Một **timeout** đủ lớn (ví dụ: 120000ms) được thiết lập riêng cho các request tạo nội dung AI, vì chúng có thể mất nhiều thời gian để xử lý.
- Các hàm như `generateContent`, `getAIHealth` được export từ file này. Chúng đóng gói logic gọi API và được các component React sử dụng.
- Việc này giúp tập trung toàn bộ logic API vào một nơi, dễ quản lý và bảo trì.

---

## Phần 5: Best Practices & Các quyết định thiết kế

### Q: Dự án đã áp dụng những Best Practices nào về Prompt Engineering?

**A:** Dựa trên file `docs/best-practices.md`, dự án áp dụng các kỹ thuật tiên tiến:

1.  **Cấu trúc Prompt rõ ràng:** Thay vì một câu lệnh mơ hồ, prompt được cấu trúc với các phần riêng biệt:
    - `ROLE`: "You are an expert {expertType} writer..."
    - `CONTEXT`: Cung cấp thông tin về Brand Voice, Target Audience.
    - `TASK`: Nhiệm vụ cụ thể cần làm.
    - `REQUIREMENTS`: Các yêu cầu chi tiết về độ dài, keywords.
    - `CONSTRAINTS`: Những điều cần tránh.
    - `OUTPUT FORMAT`: Yêu cầu AI trả về kết quả theo một định dạng JSON cụ thể để dễ dàng parse ở backend. Đây là điểm mấu chốt để giải quyết vấn đề AI trả về HTML thay vì text thuần.
2.  **Chain-of-Thought Prompting (Conceptual):** Hướng dẫn AI suy nghĩ từng bước để giải quyết các vấn đề phức tạp, giúp tăng chất lượng và độ logic của nội dung.
3.  **Few-Shot Learning (Conceptual):** Cung cấp một vài ví dụ về nội dung mong muốn ngay trong prompt để AI "học" theo văn phong.

### Q: Tại sao lại cần một file `dev-server.ts` riêng thay vì dùng `server.ts`?

**A:** Trong quá trình phát triển, file `server.ts` gốc có thể chứa rất nhiều thiết lập phức tạp cho môi trường production như kết nối database, Passport.js, session, logging đầy đủ... Điều này làm cho việc khởi động server để test một tính năng nhỏ trở nên chậm chạp và phức tạp.

Việc tạo ra `dev-server.ts` là một quyết định thực tế để **tăng tốc độ phát triển**:

- **Tối giản:** Nó chỉ khởi tạo những gì thực sự cần thiết cho việc phát triển và test các endpoint AI (Express app, CORS, và các route AI).
- **Tập trung:** Giúp developer tập trung vào logic của `HybridAIService` mà không bị phân tâm bởi các thành phần khác.
- **Dễ debug:** Một server đơn giản hơn sẽ ít lỗi hơn và dễ dàng truy vết vấn đề hơn.

### Q: Hệ thống đảm bảo an toàn và bảo mật như thế nào?

**A:**

1.  **Không hard-code secrets:** Như đã thấy trong quá trình commit, hệ thống có cơ chế push protection của GitHub để ngăn chặn việc commit API keys. Các keys được quản lý qua biến môi trường (`.env`).
2.  **Authentication & Authorization:** Sử dụng JWT và RBAC (Role-based access control) để đảm bảo chỉ những người dùng có quyền mới truy cập được tài nguyên.
3.  **API Security:** Sử dụng các middleware như Helmet để chống lại các lỗ hổng phổ biến (XSS, CSRF), và rate limiting để chống tấn công DoS.
4.  **Data Encryption:** Thiết kế kiến trúc đề cập đến việc mã hóa các thông tin nhạy cảm (như credentials kết nối platform) ở tầng database.

---

## Phần 6: Quản Lý Dự Án & Maintenance

### Q: Dự án đã được tối ưu hóa và dọn dẹp như thế nào?

**A:** Dự án đã trải qua một quá trình dọn dẹp toàn diện để đảm bảo code base sạch sẽ và maintainable:

**Files đã được xóa bỏ:**

- **Test files không cần thiết**: `test-routes.ts`, `test-passport.ts`, `test-env.ts`, `test-logger.ts`, `test-ai-api.ts`, `test-api.ts`, `test-server.ts`
- **Debug files**: `debug-gemini.js`, `debug-server.ts`
- **Server files trùng lặp**: `minimal-server.ts`, `working-server.ts`, `simple-main-server.ts`, `simple-server.ts`, `gemini-server.ts`, `final-server.ts`
- **Script files không dùng**: `test-manual-selection.sh`, `test-manual-selection-comprehensive.sh`, `start-hybrid.sh`, `start-gemini.sh`
- **Empty directories**: `shared/` folder
- **Unused files**: `start.ts`, empty `package-lock.json` ở root

**Cấu trúc cuối cùng được tối ưu:**

- **Backend servers**: Chỉ giữ lại `dev-server.ts` (development), `server.ts` (production), và `production-server.ts` (production config)
- **Package.json**: Đã cập nhật scripts để sử dụng đúng entry points
- **Clean architecture**: Loại bỏ code duplication và files không cần thiết

**Lợi ích của việc dọn dẹp:**

1. **Giảm confusion**: Developer không bị bối rối bởi nhiều file server tương tự
2. **Tăng performance**: Ít files hơn = build time nhanh hơn
3. **Dễ maintain**: Code base sạch sẽ, dễ hiểu và bảo trì
4. **Professional**: Thể hiện kỹ năng quản lý dự án chuyên nghiệp

### Q: Làm thế nào để đảm bảo dự án có thể scale và maintain trong tương lai?

**A:** Dự án được thiết kế với các nguyên tắc scalability và maintainability:

**1. Modular Architecture:**

- Separation of concerns rõ ràng giữa controllers, services, routes
- Dependency injection pattern cho easy testing và mocking
- Interface-based design cho flexibility

**2. Code Quality:**

- TypeScript cho type safety
- ESLint configuration cho code consistency
- Structured logging với Winston
- Error handling patterns nhất quán

**3. Documentation:**

- Comprehensive API documentation
- Technical architecture documentation
- Best practices guidelines
- Interview preparation materials (như file này!)

**4. Development Workflow:**

- Git workflow với proper branching
- Environment configuration management
- Docker containerization cho consistent deployment
- Automated testing framework (planned)
