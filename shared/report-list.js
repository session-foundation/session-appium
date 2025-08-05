function initReportPage(pathInRepo, platformLabel) {
  document.title = `${platformLabel} Regression Reports`;
  const h1 = document.querySelector('h1');
  if (h1.textContent.trim() === 'Loading...') {
    h1.textContent = `${platformLabel} Regression Reports`;
  }

  const apiUrl = `https://api.github.com/repos/session-foundation/session-appium/contents/${pathInRepo}?ref=gh-pages`;

  function timeAgo(dateString) {
    const now = new Date();
    const then = new Date(dateString);
    const seconds = Math.floor((now - then) / 1000);
    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
      { label: 'second', seconds: 1 },
    ];
    for (const { label, seconds: intervalSeconds } of intervals) {
      const count = Math.floor(seconds / intervalSeconds);
      if (count >= 1) return `${count} ${label}${count !== 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  function createReportLinkFromMetadata(folderName, metadata, timestamp) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `./${folderName}/`;
    a.target = '_blank';
    a.className = 'report-link';

    const labelBlock = document.createElement('span');
    labelBlock.style.display = 'inline-flex';
    labelBlock.style.alignItems = 'baseline';

    const label = document.createElement('span');
    label.className = 'version-label';
    label.textContent = metadata.build;
    labelBlock.appendChild(label);

    if (metadata.risk) {
      const riskLabel = document.createElement('span');
      riskLabel.className = 'risk-label';
      riskLabel.textContent = metadata.risk === 'full'
        ? '· Full suite'
        : `· ${metadata.risk.charAt(0).toUpperCase() + metadata.risk.slice(1)}`;
      labelBlock.appendChild(riskLabel);
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';

    if (timestamp) {
      const dateObj = new Date(timestamp);
      timeSpan.textContent = timeAgo(timestamp);
      timeSpan.title = dateObj.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    a.appendChild(labelBlock);
    a.appendChild(timeSpan);
    li.appendChild(a);
    return li;
  }

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      const reportList = document.getElementById('reportList');
      reportList.innerHTML = '';

      const reports = data.filter(item =>
        item.type === 'dir' && item.name.includes('run-')
      );

      return Promise.all(reports.map(async report => {
        try {
          const [metadata, summary] = await Promise.all([
            fetch(`./${report.name}/metadata.json`).then(res => res.ok ? res.json() : null),
            fetch(`./${report.name}/widgets/summary.json`).then(res => res.ok ? res.json() : null)
          ]);

          const timestamp = summary?.time?.stop
            ? new Date(summary.time.stop).toISOString()
            : null;

          if (!metadata || metadata.runNumber == null) return null;

          return {
            name: report.name,
            metadata,
            timestamp
          };
        } catch {
          return null;
        }
      }));
    })
    .then(entries => {
      const reportList = document.getElementById('reportList');
      entries
        .filter(entry => entry !== null)
        .sort((a, b) => {
          if (a.metadata.runNumber !== b.metadata.runNumber) {
            return b.metadata.runNumber - a.metadata.runNumber;
          }
          return b.metadata.runAttempt - a.metadata.runAttempt;
        })
        .forEach(({ name, metadata, timestamp }) => {
          reportList.appendChild(createReportLinkFromMetadata(name, metadata, timestamp));
        });
    })
    .catch(error => {
      console.error(`Failed to load ${platformLabel} reports:`, error);
      document.getElementById('reportList').innerHTML = `<li>Error loading reports.</li>`;
    });
}
