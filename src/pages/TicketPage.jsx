// 负责人：成员 4。
// 我的门票。转让和退票是本页上的确认弹窗，不要再拆成新页面。
// 钱包调用放在 src/wallet/ethereum.js，链上查询放在 src/chain/read.js。

export function TicketPage() {
  return (
    <section className="card">
      <h2>My ticket</h2>
      <p className="lede">Page frame. Ticket status, transfer, and return are left for member 4.</p>
    </section>
  );
}
