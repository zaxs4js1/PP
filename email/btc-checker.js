
async function fetchBalance(address, coinType) {
  try {
    if (coinType === "BTC") {
      const res = await fetch(`https://blockstream.info/api/address/${address}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const confirmed = data.chain_stats?.funded_txo_sum - data.chain_stats?.spent_txo_sum;
      return confirmed != null ? confirmed / 1e8 : 0;
    } else if (coinType === "ETH") {
      const etherscanApiKey = "F61UHJ8XQC6EVSUTUEE25I8CP7VZ1HR4YC";
      const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanApiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const balance = parseFloat(data.result) / 1e18;
      return isNaN(balance) ? 0 : balance;
    }
  } catch (e) {
    console.error("查詢失敗：", address, e);
    return null;
  }
}

function getAddressLink(address, coinType) {
  if (coinType === "ETH") {
    return `https://etherscan.io/address/${address}`;
  } else {
    return `https://blockstream.info/address/${address}`;
  }
}

function sendEmailAlert(content) {
  emailjs.send("service_peg0f0q", "template_k59e23e", { message: content })
    .then(() => console.log("📧 Email sent"))
    .catch(err => console.error("❌ Email failed:", err));
}

async function startCheck() {
  const text = document.getElementById("inputText").value;
  const tbody = document.querySelector("#resultTable tbody");
  const coinMode = document.getElementById("coinMode").value;
  tbody.innerHTML = "";
  document.getElementById("resultTable").style.display = "table";

  const btcRegex = /\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{11,90})\b/gi;
  const ethRegex = /\b0x[a-fA-F0-9]{40}\b/g;

  const results = [];
  const lines = text.split(/\n+/);

  for (const line of lines) {
    const labelMatch = line.match(/^\w+/);
    const label = labelMatch ? labelMatch[0] : "";

    if (coinMode === "both" || coinMode === "BTC") {
      for (const m of line.matchAll(btcRegex)) {
        results.push({ address: m[0], word: label, coin: "BTC" });
      }
    }
    if (coinMode === "both" || coinMode === "ETH") {
      for (const m of line.matchAll(ethRegex)) {
        results.push({ address: m[0], word: label, coin: "ETH" });
      }
    }
  }

  document.getElementById("status").innerText = `共偵測到 ${results.length} 筆地址，開始查詢中...`;

  const finalResults = [];
  const emailContents = [];

  for (let i = 0; i < results.length; i++) {
    const { address, word, coin } = results[i];
    document.getElementById("status").innerText = `查詢中 (${i + 1}/${results.length})：${address}`;
    const balance = await fetchBalance(address, coin);
    if (balance > 0) {
      emailContents.push(`${word} ${address} (${coin}) 餘額：${balance.toFixed(8)}`);
    }
    finalResults.push({ address, word, coin, balance });
  }

  if (emailContents.length > 0) {
    sendEmailAlert(emailContents.join("\n"));
  }

  finalResults
    .filter(r => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .forEach(({ address, word, coin, balance }) => {
      const highlight = balance > 0 ? "highlight" : "";
      const link = getAddressLink(address, coin);
      const addrCell = `<a href="${link}" target="_blank">${address}</a>`;
      const row = document.createElement("tr");
      row.innerHTML = `<td class="${highlight}">${word}</td><td class="${highlight}">${addrCell}</td><td class="${highlight}">${coin}</td><td class="${highlight}">${balance.toFixed(8)}</td>`;
      tbody.appendChild(row);
    });

  document.getElementById("status").innerText = "查詢完成。";
}

function exportExcel() {
  const table = document.getElementById("resultTable");
  const wb = XLSX.utils.table_to_book(table, { sheet: "餘額查詢" });
  XLSX.writeFile(wb, "btc_eth_balance.xlsx");
}
