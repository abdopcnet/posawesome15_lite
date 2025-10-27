<!-- @ngrie -->
<template>
  <div style="
    font-size: 0.8rem">
    <main>
      <Navbar @changePage="setPage" />
      <keep-alive>
        <component :is="page" style="
          margin: 0 auto;
          max-width: 100%;
          width: 100%;
          min-height: calc(100vh - 32px)" />
      </keep-alive>
    </main>
  </div>
</template>

<script src="./Home.js" />
