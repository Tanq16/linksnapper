package internal

import (
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type HealthChecker struct {
	store    *Store
	client   *http.Client
	interval time.Duration
	running  bool
	mu       sync.Mutex
}

func NewHealthChecker(store *Store, interval time.Duration) *HealthChecker {
	return &HealthChecker{
		store: store,
		client: &http.Client{
			Timeout: 10 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return http.ErrUseLastResponse
				}
				return nil
			},
		},
		interval: interval,
	}
}

func (hc *HealthChecker) Start() {
	hc.mu.Lock()
	if hc.running {
		hc.mu.Unlock()
		return
	}
	hc.running = true
	hc.mu.Unlock()
	go func() {
		ticker := time.NewTicker(hc.interval)
		defer ticker.Stop()
		for {
			if !hc.running {
				return
			}
			hc.CheckAllLinks()
			<-ticker.C
		}
	}()
}

func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	hc.running = false
	hc.mu.Unlock()
}

func (hc *HealthChecker) CheckAllLinks() {
	links := hc.store.GetLinks()
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, 10)
	for i := range links {
		wg.Add(1)
		go func(link *Link) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			health := hc.CheckLink(link.URL)
			link.Health = health
			link.LastChecked = time.Now()
			err := hc.store.UpdateLink(link.ID, *link)
			if err != nil {
				log.Error().Err(err).Str("url", link.URL).Msg("Failed to update link health status")
			}
		}(&links[i])
	}
	wg.Wait()
}

func (hc *HealthChecker) CheckLink(url string) Health {
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return Health{
			Status: "unhealthy",
			Error:  "Invalid URL",
		}
	}
	resp, err := hc.client.Do(req)
	if err != nil {
		return Health{
			Status: "unhealthy",
			Error:  err.Error(),
		}
	}
	defer resp.Body.Close()
	// Consider 2xx and 3xx status codes as healthy
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return Health{
			Status:     "healthy",
			StatusCode: resp.StatusCode,
		}
	}
	return Health{
		Status:     "unhealthy",
		StatusCode: resp.StatusCode,
	}
}
