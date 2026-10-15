/**
 * UI 렌더링 및 DOM 이벤트 제어 모듈 (ui.js)
 * 상태(State)와 뷰(View)의 단방향 동기화 및 감성적 인터랙션 지원
 */

import { CAMPAIGN_CONFIG, PRODUCT_MASTER, PRESET_COMBOS, ALL_COMBINATIONS } from './config.js';
import { calculateOrder, formatKRW } from './pricing.js';
import { getScheduleStatus } from './schedule.js';

// 애플리케이션 상태 (In-Memory State)
export const state = {
  selection: {
    'RM-101': 0,
    'RM-102': 0,
    'RM-103': 0
  }
};

/**
 * 초기화 및 전체 렌더링 실행
 */
export function initUI() {
  renderScheduleBadge();
  renderProducts();
  renderPresets();
  renderCombinationTable();
  updateCalculator();

  // 1분마다 KST 일정 상태 갱신
  setInterval(renderScheduleBadge, 60000);
}

/**
 * 프로모션 상태 뱃지 렌더링
 */
export function renderScheduleBadge() {
  const badgeEl = document.getElementById('heroScheduleBadge');
  const descEl = document.getElementById('heroScheduleDesc');
  if (!badgeEl) return;

  const schedule = getScheduleStatus();
  badgeEl.className = `schedule-badge ${schedule.badgeClass}`;
  badgeEl.innerHTML = `<span class="pulse-dot" aria-hidden="true"></span> ${escapeHTML(schedule.badgeText)}`;

  if (descEl) {
    descEl.textContent = `${schedule.description} (기준시각: ${schedule.kstTimeStr})`;
  }
}

/**
 * 상품 카드 목록 렌더링
 */
export function renderProducts() {
  const container = document.getElementById('productList');
  if (!container) return;

  container.innerHTML = '';

  PRODUCT_MASTER.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.id = `product-card-${product.id}`;
    card.setAttribute('aria-labelledby', `product-title-${product.id}`);

    card.innerHTML = `
      <div class="product-badge-group">
        <span class="product-badge-pill">${escapeHTML(product.badge)}</span>
        <span class="product-tagline">${escapeHTML(product.tagline)}</span>
      </div>
      <div class="product-image-container">
        <div class="food-plate-shadow"></div>
        <img 
          src="${escapeHTML(product.image)}" 
          alt="${escapeHTML(product.altText)}" 
          class="product-real-img"
          loading="lazy" 
          onerror="this.onerror=null; this.src='${escapeHTML(product.fallbackImage)}';"
        />
        <div class="selected-check-bubble" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      <div class="product-body">
        <span class="product-category">${product.category === 'rice' ? '든든한 간편 덮밥·볶음밥' : '산뜻한 프레시 샐러드'}</span>
        <h3 class="product-title" id="product-title-${product.id}">${escapeHTML(product.name)}</h3>
        <p class="product-desc">${escapeHTML(product.description)}</p>
        <div class="product-price-row">
          <span class="price-label">정상가</span>
          <span class="product-price">${formatKRW(product.price)}<span class="unit">원</span></span>
        </div>
      </div>
      <div class="product-counter-wrap">
        <button type="button" class="btn-counter btn-minus" data-id="${product.id}" aria-label="${escapeHTML(product.name)} 수량 1개 빼기">−</button>
        <input type="number" class="input-counter" id="input-${product.id}" data-id="${product.id}" min="0" max="${CAMPAIGN_CONFIG.calculatorItemLimit}" value="0" aria-label="${escapeHTML(product.name)} 수량 입력" />
        <button type="button" class="btn-counter btn-plus" data-id="${product.id}" aria-label="${escapeHTML(product.name)} 수량 1개 더하기">+</button>
      </div>
    `;

    container.appendChild(card);
  });

  // 이벤트 위임
  container.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('.btn-minus');
    const plusBtn = e.target.closest('.btn-plus');

    if (minusBtn) {
      const id = minusBtn.dataset.id;
      updateQuantity(id, -1);
    } else if (plusBtn) {
      const id = plusBtn.dataset.id;
      updateQuantity(id, 1);
    }
  });

  container.addEventListener('change', (e) => {
    const input = e.target.closest('.input-counter');
    if (input) {
      const id = input.dataset.id;
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      setQuantity(id, val);
    }
  });
}

/**
 * 추천 세트 프리셋 버튼 렌더링
 */
export function renderPresets() {
  const container = document.getElementById('presetList');
  if (!container) return;

  container.innerHTML = '';

  PRESET_COMBOS.forEach((combo) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-card-chip';
    btn.setAttribute('data-combo-id', combo.id);
    btn.innerHTML = `
      <div class="preset-chip-top">
        <span class="preset-tag-badge">${escapeHTML(combo.tag)}</span>
        <span class="preset-title">${escapeHTML(combo.title)}</span>
      </div>
      <span class="preset-sub">${escapeHTML(combo.subtitle)}</span>
      <span class="preset-action-hint">선택하기 →</span>
    `;

    btn.addEventListener('click', () => {
      applyPreset(combo.items);
    });

    container.appendChild(btn);
  });
}

/**
 * 6개 조합 전체 가격표 렌더링
 */
export function renderCombinationTable() {
  const tbody = document.getElementById('comboTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  ALL_COMBINATIONS.forEach((combo, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="combo-idx">${index + 1}</td>
      <td class="combo-name">
        <div class="combo-name-wrap">
          <strong>${escapeHTML(combo.name)}</strong>
          <span class="combo-sub-badge">${escapeHTML(combo.badge)}</span>
        </div>
      </td>
      <td class="combo-subtotal">${formatKRW(combo.subtotal)}원</td>
      <td class="combo-discount">
        <span class="badge-dc-rate">−20%</span>
        <span>−${formatKRW(combo.discount)}원</span>
      </td>
      <td class="combo-payable highlight-price">${formatKRW(combo.payable)}원</td>
      <td class="combo-per-meal">
        <span class="per-meal-tag">1끼당</span>
        <strong>${formatKRW(combo.perMeal)}원</strong>
      </td>
    `;
    tbody.appendChild(row);
  });
}

/**
 * 수량 변경 (증감)
 * @param {string} productId
 * @param {number} delta
 */
export function updateQuantity(productId, delta) {
  const current = state.selection[productId] || 0;
  const next = Math.max(0, current + delta);
  setQuantity(productId, next);
}

/**
 * 수량 직접 설정
 * @param {string} productId
 * @param {number} count
 */
export function setQuantity(productId, count) {
  const currentTotalWithoutTarget = Object.entries(state.selection)
    .filter(([id]) => id !== productId)
    .reduce((sum, [, c]) => sum + c, 0);

  const maxAllowed = CAMPAIGN_CONFIG.calculatorItemLimit;
  if (currentTotalWithoutTarget + count > maxAllowed) {
    count = Math.max(0, maxAllowed - currentTotalWithoutTarget);
    showNoticeToast(`하루 최대 할인 대상 수량은 총 ${maxAllowed}개입니다.`);
  }

  state.selection[productId] = count;
  syncInputs();
  updateCalculator();
}

/**
 * 추천 조합 적용
 * @param {Record<string, number>} items
 */
export function applyPreset(items) {
  for (const p of PRODUCT_MASTER) {
    state.selection[p.id] = items[p.id] || 0;
  }
  syncInputs();
  updateCalculator();
  showNoticeToast('추천 조합이 계산기에 즉시 반영되었습니다!');

  // 모바일인 경우 계산기 위치로 부드럽게 스크롤
  if (window.innerWidth < 1024) {
    const calcSection = document.getElementById('calc-section');
    if (calcSection) {
      calcSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

/**
 * 선택 초기화
 */
export function resetSelection() {
  for (const p of PRODUCT_MASTER) {
    state.selection[p.id] = 0;
  }
  syncInputs();
  updateCalculator();
  showNoticeToast('선택한 수량이 모두 초기화되었습니다.');
}

/**
 * 입력창(input) 값 동기화 및 버튼 활성/비활성 제어
 */
function syncInputs() {
  const totalCount = Object.values(state.selection).reduce((a, b) => a + b, 0);
  const isMaxReached = totalCount >= CAMPAIGN_CONFIG.calculatorItemLimit;

  PRODUCT_MASTER.forEach((product) => {
    const input = document.getElementById(`input-${product.id}`);
    const card = document.getElementById(`product-card-${product.id}`);
    const plusBtn = card?.querySelector('.btn-plus');

    const count = state.selection[product.id] || 0;
    if (input) input.value = count;

    if (card) {
      if (count > 0) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }

    if (plusBtn) {
      plusBtn.disabled = isMaxReached;
    }
  });
}

/**
 * 가격 계산기 DOM 갱신
 */
export function updateCalculator() {
  const result = calculateOrder(state.selection, PRODUCT_MASTER, CAMPAIGN_CONFIG);

  // 1. 선택 상품 요약 리스트
  const selectedListEl = document.getElementById('calcSelectedItems');
  if (selectedListEl) {
    if (result.selectedItems.length === 0) {
      selectedListEl.innerHTML = '<li class="empty-state">메뉴 카드의 <strong>+</strong> 버튼을 눌러 원하는 조합을 담아보세요.</li>';
    } else {
      selectedListEl.innerHTML = result.selectedItems
        .map(
          (item) => `
          <li class="selected-item-row">
            <span class="item-name">${escapeHTML(item.name)} <span class="item-count-chip">${item.count}개</span></span>
            <span class="item-subtotal">${formatKRW(item.itemSubtotal)}원</span>
          </li>
        `
        )
        .join('');
    }
  }

  // 2. 수량 및 금액 수치 바인딩
  setText('calcTotalCount', `${result.totalCount}개`);
  setText('calcSubtotal', `${formatKRW(result.subtotal)}원`);

  const discountRow = document.getElementById('calcDiscountRow');
  const discountEl = document.getElementById('calcDiscountAmount');
  const payableEl = document.getElementById('calcPayableAmount');
  const perMealRow = document.getElementById('calcPerMealRow');
  const perMealEl = document.getElementById('calcPerMealPrice');
  const msgEl = document.getElementById('calcStatusMessage');

  if (result.isEligible) {
    if (discountRow) discountRow.style.display = 'flex';
    if (discountEl) discountEl.textContent = `−${formatKRW(result.discountAmount)}원`;
    if (payableEl) {
      payableEl.textContent = `${formatKRW(result.finalPayable)}원`;
      payableEl.classList.add('discount-applied');
    }

    if (result.perMealPrice !== null && perMealRow && perMealEl) {
      perMealRow.style.display = 'flex';
      perMealEl.textContent = `${formatKRW(result.perMealPrice)}원`;
    } else if (perMealRow) {
      perMealRow.style.display = 'none';
    }
  } else {
    if (discountRow) discountRow.style.display = 'none';
    if (payableEl) {
      payableEl.textContent = `${formatKRW(result.finalPayable)}원`;
      payableEl.classList.remove('discount-applied');
    }
    if (perMealRow) perMealRow.style.display = 'none';
  }

  // 3. 상태 안내 메시지 & 스크린리더 라이브 리전
  if (msgEl) {
    msgEl.textContent = result.statusMessage;
    if (result.isEligible) {
      msgEl.className = 'status-msg success';
    } else if (result.totalCount === 1) {
      msgEl.className = 'status-msg warning';
    } else {
      msgEl.className = 'status-msg info';
    }
  }

  // 4. 모바일 하단 플로팅 바 동기화
  const floatingCount = document.getElementById('floatCount');
  const floatingPrice = document.getElementById('floatPrice');
  const floatingBar = document.getElementById('mobileFloatingBar');

  if (floatingCount && floatingPrice && floatingBar) {
    if (result.totalCount > 0) {
      floatingBar.classList.add('active');
      floatingCount.textContent = `담은 상품: 총 ${result.totalCount}개`;
      floatingPrice.textContent = `${formatKRW(result.finalPayable)}원${result.isEligible ? ' (20% 즉시할인)' : ''}`;
    } else {
      floatingBar.classList.remove('active');
    }
  }

  // ARIA 라이브 리전
  const liveRegion = document.getElementById('a11yLiveRegion');
  if (liveRegion && result.totalCount > 0) {
    liveRegion.textContent = `선택 상품 총 ${result.totalCount}개, 예상 결제액 ${formatKRW(result.finalPayable)}원. ${result.statusMessage}`;
  }
}

/**
 * 텍스트 안전 설정 헬퍼
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * 토스트 알림 표시
 */
export function showNoticeToast(message) {
  let toast = document.getElementById('noticeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'noticeToast';
    toast.className = 'toast-notice';
    toast.setAttribute('role', 'alert');
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

/**
 * HTML 특수문자 이스케이프
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
