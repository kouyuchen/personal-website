# personal-website

一个极简个人网站：白底黑字、一句话居中，包含英语填空和在线双人五子棋，手机与电脑自适应。

- **访问地址**：https://personal-website-d3e2bi65f7a84f7-1301197628.tcloudbaseapp.com
  - 注意：默认域名末尾是 **-1301197628**。如果写成 `-1301197626`，CloudBase 会返回 `INVALID_HOST`，这不是网站故障，而是域名不匹配。
- **技术栈**：Vite + React + TypeScript + CloudBase 云函数 + PostgreSQL
- **托管**：腾讯云 CloudBase 静态网站托管（个人版，地域 ap-shanghai，环境 ID personal-website-d3e2bi65f7a84f7）
- **域名**：使用 CloudBase 默认域名，未绑定自定义域名，不需要 ICP 备案
- **英语填空**：纯前端
- **五子棋**：云函数 + PostgreSQL；游客匿名身份，无需注册

## 在线五子棋

- 入口：首页「在线五子棋」，或直接打开 默认域名 + #/gomoku
- 创建棋局的人执黑先手，把页面上的邀请链接（默认域名 + ?room=房间号）发给朋友；对方打开链接自动加入并执白
- 邀请链接用查询参数而不是 hash，因为默认域名的「确定访问」中间页会丢掉 hash、保留查询参数
- 双方棋盘通过服务器同步，刷新页面或短时断网后会自动恢复
- 每局结束后，双方都看到「重新开始」；一方点击只记录同意，棋盘保持原样并显示「等待对方同意重新开始」，另一方看到「对方已同意重新开始」
- 只有双方都同意后才创建下一局：棋盘清空、黑棋先手、回合/胜负/落子记录重置、局数 +1
- 每次重开双方交换黑白：上一局执黑者变白、执白者变黑，每局交换一次
- 同意状态和颜色都写在服务端棋局 state 里，刷新或断线重连不会丢失；颜色不依赖浏览器各自计算
- 悔棋：只有当前应落子方可以申请；对局结束后按最后一步的下一手判断（A 获胜后轮到 B，B 可申请）
- 同意悔棋后撤销最近双方各一步（两颗棋子），清除胜负/平局，回到 active，由申请者重新落子；不足一轮双方落子不能悔棋
- 等待期间不能落子、不能重新开始、不能重复申请；对方可同意或拒绝，申请方可取消；没有超时自动同意
- 悔棋历史和待处理申请存在服务端 state，刷新或断线重连不会丢失；悔棋不改变颜色和局数
- 重新开始投票在悔棋等待期间暂停；悔棋被拒绝/取消后投票保留，悔棋被同意后清除投票并继续原局
- 同一浏览器游客只能占一个席位；第三个人打开链接会提示房间已满
- 游客身份由 CloudBase 匿名登录自动生成，不做注册、不收集资料；清空浏览器存储会失去原席位

**同步方式**：当前环境的文档数据库未开通，PG 环境的 CloudBase Realtime 仍是 Private Alpha 且当前挂起，因此没有使用实时监听。改为云函数 + 自适应短轮询（等待 2 秒 / 对方回合 1 秒 / 自己回合 2.5 秒 / 结束 3 秒；有人同意重开或悔棋申请挂起时 1 秒），延迟约 1 秒。同步层已抽象为 src/lib/roomTransport.ts 接口，未来可以替换为 WebSocket/Realtime，页面和规则不用改。

**费用**：只消耗云函数调用和数据库调用资源点（云函数 13 点/万次，数据库 200 点/万次）。两人 30 分钟对局约 3,000 次轮询、约 64 点；个人版每月 40,000 点，正常使用足够。未购买任何额外服务，也未启用 Realtime Alpha。

## 修改网站文字

编辑 [`src/content.ts`](./src/content.ts) 中的 siteText，然后重新构建并部署：

~~~bash
pnpm build
tcb hosting deploy ./dist -e personal-website-d3e2bi65f7a84f7 --verify --entry index.html
~~~

## 修改英语填空题

题目和答案在 [`src/questions.ts`](./src/questions.ts)，判题逻辑在 [`src/lib/gradeAnswer.ts`](./src/lib/gradeAnswer.ts)。

- sentence：题目句子，用 _____ 表示空缺
- answer：标准答案（判断时忽略前后空格和大小写）
- id：每题唯一

加题时往 fillBlankQuestions 数组追加一项即可。

## 修改五子棋规则

- 棋盘大小、连子数：[`cloudbase/functions/rooms/lib/gomoku.js`](./cloudbase/functions/rooms/lib/gomoku.js) 里的 BOARD_SIZE、WIN_LENGTH
- 前端棋盘绘制同步值：[`src/gomoku/Board.tsx`](./src/gomoku/Board.tsx) 里的 SIZE 和星位
- 改完重新部署 rooms 云函数和静态站
- 注意：改棋盘大小会影响旧房间的 state 结构，建议只对新房间生效；目前固定 15×15、五连及以上获胜、无禁手

## 本地开发

~~~bash
pnpm install
pnpm dev --host localhost --port 8080   # 8080 已在 CloudBase 安全域名里
pnpm build
pnpm preview
~~~

## 目录结构

~~~text
index.html
src/main.tsx                 React 入口
src/App.tsx                  首页 + hash 路由
src/content.ts               网站文字
src/questions.ts             英语填空题库
src/lib/gradeAnswer.ts       英语判题
src/components/FillBlankQuiz.tsx
src/lib/guest.ts             游客匿名登录
src/lib/roomApi.ts           云函数调用封装
src/lib/roomTypes.ts         房间/棋局类型
src/lib/roomTransport.ts     同步传输层接口
src/lib/useRoomSync.ts       房间加入、轮询、心跳、断线重试
src/lib/useHashRoute.ts      #/ 与 #/gomoku 路由
src/gomoku/GomokuPage.tsx    五子棋页面入口
src/gomoku/Lobby.tsx         创建/加入
src/gomoku/Room.tsx          房间、邀请、状态、操作
src/gomoku/Board.tsx         15×15 SVG 棋盘
src/styles.css               全站样式
cloudbase/migrations/        PostgreSQL 迁移（rooms 表 + RPC）
cloudbase/functions/rooms/   可复用房间服务 + 五子棋逻辑
cloudbase/functions/roomsCleanup/  过期房间清理
cloudbase/authz.rego         OPA 策略参考
cloudbase/function-security-rule.json  函数级安全规则参考
cloudbaserc.json             云函数部署配置
~~~

## 云端资源

### PostgreSQL 表 rooms

通用双人房间表（当前只用于 gomoku）：

- id、kind、status（waiting/active/finished）
- host_uid、guest_uid、capacity
- state（五子棋棋盘/回合/胜负/最后一手/局数/双方颜色 colors/重开同意 rematch/落子历史 history/悔棋申请 undoRequest）
- version（并发控制）、host_seen_at、guest_seen_at
- created_at、updated_at、last_active_at

RLS 已开启且无客户端策略；anon/authenticated 无表权限；service_role 可访问。客户端不能直接读表或调 RPC。

**数据库函数**（只授权 service_role）：

- room_create
- room_join
- room_get
- room_commit_state
- room_cleanup

### 云函数

- **rooms**：whoami / createRoom / joinRoom / getRoom / gomokuMove / gomokuRematch（旧 gomokuRestart 保留为兼容别名）/ gomokuUndoRequest / gomokuUndoAccept / gomokuUndoReject / gomokuUndoCancel
- **roomsCleanup**：每天 04:00 清理 7 天无活动房间

### 鉴权配置（重要）

PG 环境客户端调用云函数要经过两道门禁，缺一不可：

1. 环境 OPA 策略（[`cloudbase/authz.rego`](./cloudbase/authz.rego)）：放通 functions 资源
2. 函数级安全规则（[`cloudbase/function-security-rule.json`](./cloudbase/function-security-rule.json)）：默认排除匿名，rooms 放通

当前环境已按上述两项配置并回读确认。**重建环境后必须重新配置**，否则匿名游客调用 rooms 会返回 403 EXCEED_AUTHORITY。

## 房间查看与管理

~~~bash
# 最近房间
tcb db execute -e personal-website-d3e2bi65f7a84f7 --sql "SELECT id,status,version,created_at,last_active_at FROM public.rooms ORDER BY created_at DESC LIMIT 20"

# 删除某个房间
tcb db execute -e personal-website-d3e2bi65f7a84f7 --sql "DELETE FROM public.rooms WHERE id='房间号'"

# 手动执行过期清理
tcb fn invoke roomsCleanup -e personal-website-d3e2bi65f7a84f7
~~~

## 部署

首次或重建环境：

~~~bash
pnpm install
pnpm build
tcb db pg migration up -e personal-website-d3e2bi65f7a84f7
tcb fn deploy rooms --force -e personal-website-d3e2bi65f7a84f7
tcb fn deploy roomsCleanup --force -e personal-website-d3e2bi65f7a84f7
tcb fn trigger create roomsCleanup --trigger-name daily-cleanup --cron "0 0 4 * * * *" -e personal-website-d3e2bi65f7a84f7
tcb hosting deploy ./dist -e personal-website-d3e2bi65f7a84f7 --verify --entry index.html
~~~

只改前端时，构建后执行最后一条 hosting 部署即可；改五子棋/悔棋/重开逻辑时，需要同时重新部署 rooms 云函数。悔棋只扩展 state，不需要数据库迁移。

## 安全与限制

- 前端只持有 Publishable Key；没有服务端 API Key、数据库密码
- 服务端从 JWT 读取 uid，不信任客户端传入的 uid
- 落子、重开投票、悔棋申请/同意/拒绝/取消都用版本号条件更新；并发提交只有一方成功，失败会自动重试
- 悔棋同意还绑定 requestId、baseVersion、回合、步数和棋盘哈希；过期申请不会错误撤销棋子
- 悔棋只能由当前落子方申请，只有对方能同意/拒绝，只有申请方能取消；服务端逐项校验
- 房间 ID 为 96 位随机数，只用于定位，不是身份凭证
- 游客身份属于单个浏览器；清空存储会失去席位
- 默认域名首次访问仍需点「确定访问」，这是平台策略
- 真实两台手机/两个网络的测试需你亲自完成；自动化测试使用的是三个独立浏览器配置，不等于真实设备

## 测试记录

已通过：

- 首页文字和英语填空仍正常
- 匿名登录 + 云函数 uid 透传
- 创建房间、邀请链接、第二位加入、第三人房间已满
- 双方轮流落子 1 秒内同步
- 非当前回合、已占位、结束后落子服务端拒绝
- 同 uid 不占第二席
- 五连获胜，双方显示一致
- 单方同意重开：保留 9 颗棋子和胜负结果，显示「等待对方同意重新开始」
- 同意后刷新：服务端 rematch 状态保留，仍显示等待
- 双方同意：棋盘清空、局数 +1、黑白交换、黑棋先手
- 第 2 局结束：按交换后的颜色正确显示「你赢了/落败」
- 连续两次重开：黑白换回原色（第 3 局）
- 断线期间对方同意；恢复后看到「对方已同意」，自己同意后正常开局
- 双方同时同意：只创建一局，局数只 +1，颜色只交换一次
- 悔棋入口只对当前落子方显示；非当前方调用返回 NOT_YOUR_TURN
- 单方申请悔棋：保留棋盘/棋子/胜负，对方看到同意/拒绝；拒绝后完全不变
- 申请方取消：棋盘和对局状态不变，恢复正常落子
- 等待期间落子、重开、重复申请都被服务端拒绝（UNDO_PENDING）
- 申请后刷新、断线重连：申请和棋盘仍正确恢复；另一方恢复后可同意
- 双方同意悔棋：撤销最近两颗棋子、清除胜负、轮到申请者，双方同步
- 获胜后由下一手方申请：撤销上一手+获胜手，胜负清除并继续对局
- 申请方自批返回 NOT_YOUR_RESPONSE；对方代取消返回 NOT_YOUR_UNDO
- 并发同意/取消：只有一个生效，最终状态一致
- 悔棋后继续下完、双方同意重开、交换黑白仍正常
- 旧局 lastMove 播种：再落一子后最近两步可悔；上线前已结束且无新落子的旧局暂不可悔
- 两个并发落子：一个成功，一个 CONFLICT
- 390/320 手机宽度无横向滚动，棋盘 358/288 正方形

## 变更记录

- 2026-11-23 初始化项目并首次部署
- 2026-11-23 补充仓库与部署信息
- 2026-11-23 增加英语填空练习
- 2026-11-26 增加可复用房间系统、游客身份、同步层与在线五子棋
- 2026-11-26 增加双方同意重开、每局交换黑白，并把同意状态与颜色存入服务端 state
- 2026-11-26 增加悔棋：当前落子方申请、对方同意后撤销最近双方各一步，支持刷新/断线恢复与并发控制
