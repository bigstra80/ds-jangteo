import WholesaleLedgerManager from "@/components/wholesale-ledger/WholesaleLedgerManager";

export default function TransactionHistoryPage() {
  return (
    <main style={{ padding: "30px", flex: 1, minWidth: 0 }}>
      <WholesaleLedgerManager listOnly />
    </main>
  );
}
