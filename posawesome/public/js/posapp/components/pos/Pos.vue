<!-- @ngrie -->
<template>
  <!-- =========================================== -->
  <!-- POS CONTAINER -->
  <!-- =========================================== -->
  <div style="padding: 0 3px 3px 3px; background: #c4763d85; min-height: 100vh; overflow: visible">
    <!-- =========================================== -->
    <!-- DIALOGS & OVERLAYS -->
    <!-- =========================================== -->
    <ClosingDialog></ClosingDialog>
    <Returns></Returns>
    <NewAddress></NewAddress>
    <OpeningDialog v-if="dialog" :dialog="dialog"></OpeningDialog>
    <OpenShiftsWarning :isOpen="showOpenShiftsWarning" :shifts="openShifts"></OpenShiftsWarning>

    <!-- =========================================== -->
    <!-- MAIN POS INTERFACE -->
    <!-- =========================================== -->
    <div
      v-show="!dialog"
      style="display: flex; gap: 5px; min-height: calc(100vh - 130px); width: 100%; margin-top: 3px"
    >
      <!-- =========================================== -->
      <!-- LEFT PANEL (Items/Offers/Payments) -->
      <!-- =========================================== -->
      <div style="flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative">
        <!-- Items Selector Panel -->
        <div
          v-show="!payment && !offers"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.05);
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          "
        >
          <ItemsSelector></ItemsSelector>
        </div>

        <!-- Offers Panel -->
        <div
          v-show="offers"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.05);
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          "
        >
          <PosOffers @offerApplied="handleOfferApplied" @offerRemoved="handleOfferRemoved"></PosOffers>
        </div>

        <!-- Payments Panel -->
        <div
          v-show="payment"
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.05);
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          "
        >
          <Payments ref="payments" @request-print="onPrintRequest"></Payments>
        </div>
      </div>

      <!-- =========================================== -->
      <!-- RIGHT PANEL (Invoice) -->
      <!-- =========================================== -->
      <div style="flex: 1; display: flex; flex-direction: column; min-width: 0">
        <div
          style="
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(0, 0, 0, 0.05);
          "
        >
          <Invoice :is_payment="payment" :offer-applied="offerApplied" :offer-removed="offerRemoved"> </Invoice>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Pos.js" />
