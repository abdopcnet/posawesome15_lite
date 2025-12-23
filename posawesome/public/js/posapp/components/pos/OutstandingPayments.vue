<!-- @ngrie -->
<template>
	<!-- =========================================== -->
	<!-- SETTLEMENT DIALOG -->
	<!-- =========================================== -->
	<div style="display: flex; justify-content: center; align-items: center">
		<!-- Modal Overlay -->
		<div
			v-if="settlementDialog"
			@click="settlementDialog = false"
			style="
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.5);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			"
		>
			<!-- Modal -->
			<div
				@click.stop
				style="
					background: white;
					border-radius: 8px;
					box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
					max-width: 90vw;
					min-width: 700px;
					width: auto;
					max-height: 90vh;
					overflow: hidden;
				"
			>
				<!-- Card -->
				<div
					style="
						background: white;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
					"
				>
					<!-- =========================================== -->
					<!-- CARD HEADER -->
					<!-- =========================================== -->
					<div
						style="
							background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
							color: white;
							padding: 12px 16px;
							border-bottom: 1px solid #e0e0e0;
							position: relative;
						"
					>
						<span
							style="
								color: white;
								display: flex;
								align-items: center;
								gap: 8px;
								font-size: 1.25rem;
								font-weight: 700;
								color: white;
							"
						>
							<i class="mdi mdi-cash-check" style="font-size: 18px"></i>
							<!-- Settlement -->
							جدول سداد
						</span>
						<button
							@click="settlementDialog = false"
							style="
								position: absolute;
								top: 8px;
								right: 8px;
								background: none;
								border: none;
								font-size: 1.5rem;
								color: white;
								cursor: pointer;
								width: 32px;
								height: 32px;
								display: flex;
								align-items: center;
								justify-content: center;
								border-radius: 50%;
							"
						>
							×
						</button>
					</div>

					<!-- =========================================== -->
					<!-- CARD BODY -->
					<!-- =========================================== -->
					<div style="padding: 16px; max-height: 60vh; overflow-y: auto">
						<!-- Loading State -->
						<div v-if="isLoading" style="text-align: center; padding: 40px">
							<div style="font-size: 1rem; color: #666">جاري التحميل...</div>
						</div>

						<!-- Empty State -->
						<div
							v-else-if="!dialog_data || dialog_data.length === 0"
							style="text-align: center; padding: 40px"
						>
							<div style="font-size: 1rem; color: #666">
								لا توجد فواتير غير مسددة أو مسددة جزئياً
							</div>
						</div>

						<!-- Table -->
						<table
							v-else
							style="width: 100%; border-collapse: collapse; font-size: 0.9rem"
						>
							<thead>
								<tr
									style="
										background: linear-gradient(
											135deg,
											#4caf50 0%,
											#388e3c 100%
										);
										border-bottom: 2px solid #e0e0e0;
										color: white;
									"
								>
									<th
										style="
											padding: 12px;
											text-align: right;
											font-weight: 600;
											color: white;
										"
									>
										العميل
									</th>
									<th
										style="
											padding: 12px;
											text-align: center;
											font-weight: 600;
											color: white;
										"
									>
										التاريخ
									</th>
									<th
										style="
											padding: 12px;
											text-align: center;
											font-weight: 600;
											color: white;
										"
									>
										الوقت
									</th>
									<th
										style="
											padding: 12px;
											text-align: right;
											font-weight: 600;
											color: white;
										"
									>
										رقم الفاتورة
									</th>
									<th
										style="
											padding: 12px;
											text-align: left;
											font-weight: 600;
											color: white;
										"
									>
										المبلغ الإجمالي
									</th>
									<th
										style="
											padding: 12px;
											text-align: left;
											font-weight: 600;
											color: white;
										"
									>
										المبلغ المتبقي
									</th>
									<th
										style="
											padding: 12px;
											text-align: center;
											font-weight: 600;
											color: white;
										"
									>
										الحالة
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="invoice in dialog_data"
									:key="invoice.name"
									@click="selectInvoice(invoice)"
									:style="
										selected && selected.name === invoice.name
											? 'background: #e8f5e9; cursor: pointer;'
											: 'cursor: pointer;'
									"
									style="border-bottom: 1px solid #e0e0e0"
								>
									<td style="padding: 12px; text-align: right">
										{{ invoice.customer_name || invoice.customer || '-' }}
									</td>
									<td style="padding: 12px; text-align: center">
										{{ invoice.posting_date || '-' }}
									</td>
									<td style="padding: 12px; text-align: center">
										{{
											invoice.posting_time
												? invoice.posting_time.split('.')[0]
												: '-'
										}}
									</td>
									<td style="padding: 12px; text-align: right; font-weight: 600">
										{{ invoice.name }}
									</td>
									<td style="padding: 12px; text-align: left; font-weight: 600">
										{{ currencySymbol(invoice.currency || 'SAR')
										}}{{ formatCurrency(invoice.grand_total || 0) }}
									</td>
									<td
										style="
											padding: 12px;
											text-align: left;
											font-weight: 600;
											color: #f57c00;
										"
									>
										{{ currencySymbol(invoice.currency || 'SAR')
										}}{{ formatCurrency(invoice.outstanding_amount || 0) }}
									</td>
									<td style="padding: 12px; text-align: center">
										<span
											:style="{
												padding: '4px 8px',
												borderRadius: '4px',
												fontSize: '0.75rem',
												fontWeight: '600',
												background:
													invoice.invoice_status === 'Unpaid'
														? '#ffebee'
														: '#fff3e0',
												color:
													invoice.invoice_status === 'Unpaid'
														? '#c62828'
														: '#f57c00',
											}"
										>
											{{
												invoice.invoice_status === 'Unpaid'
													? 'غير مسددة'
													: 'مسددة جزئياً'
											}}
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- =========================================== -->
					<!-- CARD FOOTER -->
					<!-- =========================================== -->
					<div
						style="
							display: flex;
							align-items: center;
							justify-content: flex-end;
							gap: 8px;
							padding: 16px;
							border-top: 1px solid #e0e0e0;
						"
					>
						<div style="flex: 1"></div>
						<button
							@click="settlementDialog = false"
							style="
								display: inline-flex;
								align-items: center;
								justify-content: center;
								padding: 8px 16px;
								border-radius: 4px;
								font-size: 13px;
								font-weight: 500;
								cursor: pointer;
								border: 1px solid #d32f2f;
								line-height: 1.5;
								margin: 0 4px;
								background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
								color: white;
							"
						>
							<!-- Close -->
							إغلاق
						</button>
						<button
							@click="submit_dialog"
							:disabled="!selected"
							style="
								display: inline-flex;
								align-items: center;
								justify-content: center;
								padding: 8px 16px;
								border-radius: 4px;
								font-size: 13px;
								font-weight: 500;
								cursor: pointer;
								border: 1px solid #388e3c;
								line-height: 1.5;
								margin: 0 4px;
								background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
								color: white;
							"
							:style="
								!selected
									? 'background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; border-color: #e0e0e0'
									: ''
							"
						>
							<!-- Load for settlement -->
							سداد
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script src="./OutstandingPayments.js" />
