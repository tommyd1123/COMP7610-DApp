// 负责人：成员 4。
// 主办方检票。按票号查询后核销，权限看合约 organizer()。
// 核销交易放在 src/wallet/ethereum.js，查询放在 src/chain/read.js。

export function DoorPage() {
  return (
    <section className="card">
      <h2>Organizer check-in</h2>
      <p className="lede">Page frame. Ticket lookup and check-in are left for member 4.</p>
    </section>
  );
}
