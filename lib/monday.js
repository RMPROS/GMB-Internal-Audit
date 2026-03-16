// lib/monday.js — Monday.com helpers for the GMB Audit Widget lead board

const API_KEY  = process.env.MONDAY_API_KEY;
const BOARD_ID = process.env.MONDAY_BOARD_ID;

// Column IDs — set via environment variables so you never touch code
const COLS = {
  contactName: process.env.MONDAY_COL_CONTACT_NAME || 'text_contact_name',
  email:       process.env.MONDAY_COL_EMAIL        || 'email_col',
  phone:       process.env.MONDAY_COL_PHONE        || 'phone_col',
  gmbUrl:      process.env.MONDAY_COL_GMB_URL      || 'text_gmb_url',
  score:       process.env.MONDAY_COL_SCORE        || 'numbers_score',
  status:      process.env.MONDAY_COL_STATUS       || 'status_col',
  source:      process.env.MONDAY_COL_SOURCE       || 'text_source',
};

async function mondayRequest(query, variables = {}) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error('Monday API error: ' + data.errors[0].message);
  return data.data;
}

// Create a new lead item on the board
export async function createLead({ companyName, contactName, email, phone, gmbUrl }) {
  const columnValues = {
    [COLS.contactName]: contactName || '',
    [COLS.email]:       { email: email, text: email },
    [COLS.phone]:       { phone: phone, countryShortName: 'US' },
    [COLS.gmbUrl]:      gmbUrl || '',
    [COLS.status]:      { label: 'Pending' },
    [COLS.source]:      'Website Widget',
  };

  const result = await mondayRequest(
    `mutation ($board: ID!, $name: String!, $cols: JSON!) {
       create_item(board_id: $board, item_name: $name, column_values: $cols) { id }
     }`,
    {
      board: BOARD_ID,
      name:  companyName,
      cols:  JSON.stringify(columnValues),
    }
  );

  return result.create_item.id;
}

// Update the item after audit completes — set score + status to Sent
export async function updateLeadAfterAudit(itemId, score) {
  if (!itemId) return;
  const columnValues = {
    [COLS.score]:  score,
    [COLS.status]: { label: 'Sent' },
  };
  try {
    await mondayRequest(
      `mutation ($board: ID!, $item: ID!, $cols: JSON!) {
         change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cols) { id }
       }`,
      { board: BOARD_ID, item: itemId, cols: JSON.stringify(columnValues) }
    );
    // Add a comment with the score summary
    await mondayRequest(
      `mutation ($item: ID!, $body: String!) {
         create_update(item_id: $item, body: $body) { id }
       }`,
      { item: itemId, body: `Audit complete via website widget.\nScore: ${score}/100\nEmail sent successfully.` }
    );
  } catch(e) {
    // Non-fatal — don't break the response if Monday update fails
    console.warn('[monday] post-audit update failed:', e.message);
  }
}

// Mark item as Error if something goes wrong
export async function markLeadError(itemId, errorMsg) {
  if (!itemId) return;
  try {
    const columnValues = { [COLS.status]: { label: 'Error' } };
    await mondayRequest(
      `mutation ($board: ID!, $item: ID!, $cols: JSON!) {
         change_multiple_column_values(board_id: $board, item_id: $item, column_values: $cols) { id }
       }`,
      { board: BOARD_ID, item: itemId, cols: JSON.stringify(columnValues) }
    );
    await mondayRequest(
      `mutation ($item: ID!, $body: String!) {
         create_update(item_id: $item, body: $body) { id }
       }`,
      { item: itemId, body: 'Audit failed: ' + (errorMsg || 'Unknown error') }
    );
  } catch(e) {
    console.warn('[monday] error update failed:', e.message);
  }
}
